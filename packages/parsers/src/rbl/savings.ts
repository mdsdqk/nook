import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * RBL Bank savings statement parser.
 *
 * Layout (from sample_data/savings/rbl.pdf):
 *   Statement of Transactions in Savings Account Number:<n>
 *   Period:DD-MM-YYYY to DD-MM-YYYY
 *   Transaction Details Cheque ID Value Date Withdrawal Amt Deposit Amt Balance(₹)
 *   DD/MM/YYYY <details> DD/MM/YYYY <amt> <balance>
 *   Statement Summary
 *   Opening Balance:₹ <n>  Closing Balance:₹ <n>
 *
 * Extracted text often uses tabs between tokens. Debit/credit columns are not
 * reliably separated, so direction is inferred from the running balance delta
 * after reversing the newest-first PDF order to chronological.
 */

const TXN_DATE = /^(\d{2}\/\d{2}\/\d{4})\b/;
const TXN_LINE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const AMOUNT = /[\d,]+\.\d{2}/g;

// Generated-at stamp + "N Page N of N" — date-prefixed so ^Page alone misses it.
const PAGE_FOOTER =
  /\bPage\s+\d+\s+of\s+\d+\b/i;

const FOOTER_MARKERS = [
  /^Statement\s+Summary\b/i,
  /^Opening\s+Balance\s*:/i,
  /^Closing\s+Balance\s*:/i,
];

export class RblSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const openingBalance = this.extractOpeningBalance(doc);
    const closingFromLine = this.extractClosingBalance(doc);
    // PDF lists newest-first; reverse so balance deltas yield debit/credit.
    const rawTxns = this.extractRawTransactions(doc).reverse();

    const transactions = rawTxns.map((raw, idx) =>
      this.finalizeTxn(raw, idx + 1, openingBalance, rawTxns.slice(0, idx)),
    );

    const closingBalance =
      closingFromLine ??
      (transactions.length > 0
        ? transactions[transactions.length - 1]!.balance
        : openingBalance);

    return {
      metadata,
      openingBalance,
      closingBalance,
      transactions,
    };
  }

  private extractMetadata(doc: ParsedDocument): StatementMetadata {
    const text = this.normalizeText(doc.rawText);

    const accountNumber =
      text.match(
        /Statement\s+of\s+Transactions\s+in\s+Savings\s+Account\s+Number\s*:\s*(\d+)/i,
      )?.[1] ??
      text.match(/Transaction\s+List\s*:.*?-\s*(\d{10,})\s*$/im)?.[1] ??
      "";

    const periodMatch = text.match(
      /Period\s*:\s*(\d{2}-\d{2}-\d{4})\s+to\s+(\d{2}-\d{2}-\d{4})/i,
    );

    const currency = /A\/c\s*Currency\s*:\s*₹/i.test(text) ? "INR" : "INR";

    return {
      bank: "RBL",
      accountType: "savings",
      accountNumber,
      statementPeriod: {
        from: periodMatch?.[1] ?? "",
        to: periodMatch?.[2] ?? "",
      },
      currency,
    };
  }

  private extractOpeningBalance(doc: ParsedDocument): number {
    const text = this.normalizeText(doc.rawText);
    const match = text.match(
      /Opening\s+Balance\s*:\s*₹?\s*([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const text = this.normalizeText(doc.rawText);
    const match = text.match(
      /Closing\s+Balance\s*:\s*₹?\s*([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
    return null;
  }

  private extractRawTransactions(doc: ParsedDocument): RawTxn[] {
    const transactions: RawTxn[] = [];
    let current: RawTxn | null = null;
    let pendingPrefix = "";
    let inHistory = false;

    for (const page of doc.pages) {
      for (const line of page.lines) {
        const trimmed = this.normalizeText(line.text);
        if (!trimmed) continue;

        if (
          /Transaction\s+Details/i.test(trimmed) &&
          /Balance/i.test(trimmed)
        ) {
          inHistory = true;
          continue;
        }

        // Header wrap: "Date" on its own line after "Transaction"
        if (/^(?:Transaction\s+)?Date$/i.test(trimmed)) {
          continue;
        }

        if (!inHistory) continue;

        // Page stamp — flush current so following wrap lines attach to the
        // next (older) row, not the previous one. Stay in history.
        if (PAGE_FOOTER.test(trimmed)) {
          if (current) {
            transactions.push(current);
            current = null;
          }
          continue;
        }

        if (FOOTER_MARKERS.some((re) => re.test(trimmed))) {
          if (current) {
            transactions.push(current);
            current = null;
          }
          inHistory = false;
          pendingPrefix = "";
          continue;
        }

        if (TXN_DATE.test(trimmed)) {
          if (current) {
            transactions.push(current);
          }
          current = this.parseTransactionLine(trimmed);
          if (pendingPrefix) {
            current.narration = `${pendingPrefix} ${current.narration}`.trim();
            pendingPrefix = "";
          }
        } else if (current) {
          current.narration += " " + trimmed;
        } else {
          // Narration wrap that appears above the dated amount row.
          pendingPrefix = pendingPrefix
            ? `${pendingPrefix} ${trimmed}`
            : trimmed;
        }
      }
    }

    if (current) {
      transactions.push(current);
    }

    return transactions;
  }

  private parseTransactionLine(text: string): RawTxn {
    const match = text.match(TXN_LINE);
    if (match) {
      return {
        date: match[1]!,
        narration: match[2]!.trim(),
        valueDate: match[3]!,
        amount: parseFloat(match[4]!.replace(/,/g, "")),
        balance: parseFloat(match[5]!.replace(/,/g, "")),
      };
    }

    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    const afterDate = text.slice(date.length).trim();

    const valueDateMatch = afterDate.match(/(\d{2}\/\d{2}\/\d{4})/);
    const valueDate = valueDateMatch?.[1] ?? "";

    const amounts: { value: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(afterDate)) !== null) {
      amounts.push({
        value: parseFloat(m[0].replace(/,/g, "")),
        index: m.index,
      });
    }

    const lastTwo = amounts.slice(-2);
    const amount = lastTwo[0]?.value ?? 0;
    const balance = lastTwo[1]?.value ?? lastTwo[0]?.value ?? 0;

    let narration = afterDate;
    if (valueDateMatch && valueDateMatch.index !== undefined) {
      narration = afterDate.slice(0, valueDateMatch.index).trim();
    } else if (lastTwo.length > 0) {
      narration = afterDate.slice(0, lastTwo[0]!.index).trim();
    }

    return { date, valueDate, narration, amount, balance };
  }

  private finalizeTxn(
    raw: RawTxn,
    sequence: number,
    openingBalance: number,
    prevRaw: RawTxn[],
  ): ParsedTransaction {
    const prevBalance =
      prevRaw.length > 0
        ? prevRaw[prevRaw.length - 1]!.balance
        : openingBalance;
    const delta = raw.balance - prevBalance;
    const isCredit = delta > 0;
    const amount = Math.abs(raw.amount);

    return {
      date: raw.date,
      narration: raw.narration.trim(),
      debit: isCredit ? null : amount,
      credit: isCredit ? amount : null,
      balance: raw.balance,
      reference: "",
      sequence,
    };
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }
}

interface RawTxn {
  date: string;
  valueDate: string;
  narration: string;
  amount: number;
  balance: number;
}
