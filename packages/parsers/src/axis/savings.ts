import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * Axis Bank generic savings statement parser.
 *
 * Layout (from sample_data/savings/axis.pdf):
 *   Statement of Axis Account No: <n> for the period (From: DD-MM-YYYY  To: DD-MM-YYYY)
 *   Tran Date Chq No Particulars Debit Credit Balance Init. Br
 *   OPENING BALANCE           <amount>
 *   <optional narration prefix line(s)>
 *   DD-MM-YYYY <particulars> <amount> <balance> <branch>
 *   TRANSACTION TOTAL <debits> <credits>
 *   CLOSING BALANCE           <amount>
 *
 * Narration often wraps onto a line *before* the dated amount row.
 * Debit/credit columns are not reliably separated in extracted text, so
 * direction is inferred from the running balance delta.
 */

const TXN_DATE = /^(\d{2}-\d{2}-\d{4})\b/;
const TXN_LINE =
  /^(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(?:\s+\d+)?\s*$/;
const AMOUNT = /[\d,]+\.\d{2}/g;

const FOOTER_MARKERS = [
  /^TRANSACTION\s+TOTAL\b/i,
  /^CLOSING\s+BALANCE\b/i,
  /^\+{2,}\s*End of Statement/i,
];

export class AxisSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const openingBalance = this.extractOpeningBalance(doc);
    const closingFromLine = this.extractClosingBalance(doc);
    const rawTxns = this.extractRawTransactions(doc);

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
    const text = doc.rawText;

    const accountNumber =
      text.match(
        /Statement\s+of\s+Axis\s+Account\s+No\s*:\s*(\d+)/i,
      )?.[1] ?? "";

    const periodMatch = text.match(
      /\(From\s*:\s*(\d{2}-\d{2}-\d{4})\s+To\s*:\s*(\d{2}-\d{2}-\d{4})\s*\)/i,
    );

    const currency = text.match(/Currency\s*:\s*(\w+)/i)?.[1] ?? "INR";

    return {
      bank: "AXIS",
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
    const match = doc.rawText.match(
      /OPENING\s+BALANCE\s+([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const match = doc.rawText.match(
      /CLOSING\s+BALANCE\s+([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
    return null;
  }

  private extractRawTransactions(doc: ParsedDocument): RawTxn[] {
    const transactions: RawTxn[] = [];
    let pendingNarration = "";
    let inHistory = false;

    for (const page of doc.pages) {
      for (const line of page.lines) {
        const trimmed = line.text.trim();
        if (!trimmed) continue;

        if (
          /Tran\s+Date/i.test(trimmed) &&
          /Particulars/i.test(trimmed) &&
          /Balance/i.test(trimmed)
        ) {
          inHistory = true;
          continue;
        }

        if (!inHistory) continue;

        // Header wraps "Init. / Br" onto a second line
        if (/^Br$/i.test(trimmed)) {
          continue;
        }

        if (/^OPENING\s+BALANCE\b/i.test(trimmed)) {
          continue;
        }

        if (FOOTER_MARKERS.some((re) => re.test(trimmed))) {
          inHistory = false;
          pendingNarration = "";
          continue;
        }

        if (TXN_DATE.test(trimmed)) {
          const raw = this.parseTransactionLine(trimmed);
          if (pendingNarration) {
            raw.narration = `${pendingNarration} ${raw.narration}`.trim();
            pendingNarration = "";
          }
          transactions.push(raw);
        } else {
          // Axis wraps narration onto the line(s) before the dated amount row
          pendingNarration = pendingNarration
            ? `${pendingNarration} ${trimmed}`
            : trimmed;
        }
      }
    }

    return transactions;
  }

  private parseTransactionLine(text: string): RawTxn {
    const match = text.match(TXN_LINE);
    if (match) {
      return {
        date: match[1]!,
        narration: match[2]!.trim(),
        amount: parseFloat(match[3]!.replace(/,/g, "")),
        balance: parseFloat(match[4]!.replace(/,/g, "")),
      };
    }

    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    const afterDate = text.slice(date.length).trim();

    // Strip trailing branch code (Init. Br), then take last two amounts
    const withoutBranch = afterDate.replace(/\s+\d{2,5}\s*$/, "");
    const amounts: { value: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(withoutBranch)) !== null) {
      amounts.push({
        value: parseFloat(m[0].replace(/,/g, "")),
        index: m.index,
      });
    }

    const lastTwo = amounts.slice(-2);
    const amount = lastTwo[0]?.value ?? 0;
    const balance = lastTwo[1]?.value ?? lastTwo[0]?.value ?? 0;
    const narration =
      lastTwo.length > 0
        ? withoutBranch.slice(0, lastTwo[0]!.index).trim()
        : withoutBranch;

    return { date, narration, amount, balance };
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
}

interface RawTxn {
  date: string;
  narration: string;
  amount: number;
  balance: number;
}
