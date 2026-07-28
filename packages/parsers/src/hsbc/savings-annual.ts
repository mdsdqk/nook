import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

const TXN_ROW =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
const DATE_RANGE = /Date\s+range:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i;

const SKIP_LINE = [
  /^about:blank\s+\d+\/\d+$/i,
  /^\d{2}\/\d{2}\/\d{4},\s+\d{1,2}:\d{2}\s+Account\s+summary\s+and\s+transactions$/i,
  /^Balance$/i,
  /^Date\s+Description\s+Credit\s+Debit\s+Balance$/i,
  /^Search\s+results$/i,
];

interface AnnualRawTxn {
  date: string;
  narration: string;
  amount: number;
  balance: number;
}

export class HsbcSavingsAnnualParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const rawTxns = this.extractRawTransactions(doc);
    const metadata = this.extractMetadata(doc, rawTxns);

    // The annual export lists rows newest -> oldest. Reverse to chronological
    // order so balances can be reconciled forward.
    const chronological = rawTxns.slice().reverse();
    const openingBalance = this.deriveOpeningBalance(chronological);
    const transactions = this.finalizeTransactions(chronological, openingBalance);
    const closingBalance =
      transactions.length > 0
        ? transactions[transactions.length - 1]!.balance
        : openingBalance;

    return {
      metadata,
      openingBalance,
      closingBalance,
      transactions,
    };
  }

  private extractMetadata(
    doc: ParsedDocument,
    transactions: AnnualRawTxn[],
  ): StatementMetadata {
    const text = doc.rawText;
    const accountNumber =
      text.match(/Account\s+number:\s*([0-9-]+)/i)?.[1] ??
      text.match(/Account\s*(?:Number|No\.?)\s*:?\s*([0-9-]+)/i)?.[1] ??
      "";

    const range = text.match(DATE_RANGE);
    const fallbackFrom = transactions.length > 0 ? transactions[0]!.date : "";
    const fallbackTo =
      transactions.length > 0 ? transactions[transactions.length - 1]!.date : "";

    return {
      bank: "HSBC",
      accountType: "savings",
      accountNumber,
      statementPeriod: {
        from: range?.[1] ?? fallbackFrom,
        to: range?.[2] ?? fallbackTo,
      },
      currency: "INR",
    };
  }

  private extractRawTransactions(doc: ParsedDocument): AnnualRawTxn[] {
    const transactions: AnnualRawTxn[] = [];
    let inHistory = false;
    let pending: AnnualRawTxn | null = null;
    let narrationParts: string[] = [];

    const flushPending = () => {
      if (!pending) {
        return;
      }
      transactions.push({
        ...pending,
        narration: [pending.narration, ...narrationParts].join(" ").trim(),
      });
      pending = null;
      narrationParts = [];
    };

    for (const page of doc.pages) {
      for (const line of page.lines) {
        const text = line.text.trim();
        if (!text) continue;

        if (/^Date\s+Description\s+Credit\s+Debit\s+Balance$/i.test(text)) {
          inHistory = true;
          continue;
        }

        if (!inHistory) continue;

        if (SKIP_LINE.some((re) => re.test(text))) {
          continue;
        }

        if (/^We refer to RBI notification/i.test(text)) {
          flushPending();
          inHistory = false;
          continue;
        }

        const txn = text.match(TXN_ROW);
        if (txn?.[1] && txn[2] && txn[3] && txn[4]) {
          flushPending();
          pending = {
            date: txn[1],
            narration: txn[2].trim(),
            amount: this.parseAmount(txn[3]),
            balance: this.parseAmount(txn[4]),
          };
          continue;
        }

        if (pending) {
          narrationParts.push(text);
        }
      }
    }

    flushPending();
    return transactions;
  }

  private deriveOpeningBalance(transactions: AnnualRawTxn[]): number {
    if (transactions.length === 0) {
      return 0;
    }

    const first = transactions[0]!;
    // Annual exports omit an explicit opening-balance line. Use a conservative
    // estimate that works for first-in-period credit rows and avoids negatives.
    return Math.max(0, first.balance - first.amount);
  }

  private finalizeTransactions(
    transactions: AnnualRawTxn[],
    openingBalance: number,
  ): ParsedTransaction[] {
    const finalized: ParsedTransaction[] = [];
    let prevBalance = openingBalance;

    for (const [index, txn] of transactions.entries()) {
      const delta = txn.balance - prevBalance;
      const isCredit = delta >= 0;

      finalized.push({
        date: txn.date,
        narration: txn.narration,
        debit: isCredit ? null : txn.amount,
        credit: isCredit ? txn.amount : null,
        balance: txn.balance,
        reference: "",
        sequence: index + 1,
      });

      prevBalance = txn.balance;
    }

    return finalized;
  }

  private parseAmount(raw: string): number {
    return parseFloat(raw.replace(/,/g, ""));
  }
}
