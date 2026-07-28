import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * IDFC FIRST Bank savings statement parser.
 *
 * Layout (from sample_data/savings/idfc.pdf):
 *   STATEMENT OF ACCOUNT
 *   ACCOUNT NO : <n>
 *   STATEMENT PERIOD : YYYY-MM-DD TO YYYY-MM-DD
 *   ACCOUNT TYPE: <product>   CURRENCY: INR
 *   Opening Balance Total Debit Total Credit Closing Balance
 *   <opening> <debits> <credits> <closing>
 *   Transaction Cheque
 *   Value Date Particulars Debit Credit Balance
 *   Date No
 *   Opening Balance <amount>
 *   <narration prefix wrap lines>
 *   DD-MMM-YYYY DD-MMM-YYYY <optional particulars> <amount> <balance>
 *   <narration suffix wrap lines>
 *   REGISTERED OFFICE: IDFC FIRST BANK LIMITED …
 *
 * Narration wraps onto lines before and after the dated amount row.
 * Debit/credit columns are not reliably separated in extracted text, so
 * direction is inferred from the running balance delta.
 */

const TXN_DATE = /^(\d{1,2}-[A-Za-z]{3}-\d{4})\b/;
const TXN_LINE =
  /^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(?:(.+?)\s+)?([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const AMOUNT = /[\d,]+\.\d{2}/g;

const FOOTER_MARKERS = [
  /^REGISTERED\s+OFFICE\s*:/i,
  /^Page\s+\d+\s+of\s+\d+/i,
  /^IMPORTANT\s+MESSAGE\b/i,
  /End\s+of\s+the\s+statement/i,
];

const HEADER_SKIP = [
  /^Transaction\s+Cheque$/i,
  /^Value\s+Date\s+Particulars/i,
  /^Date\s+No$/i,
  /^Opening\s+Balance\b/i,
];

export class IdfcSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const openingBalance = this.extractOpeningBalance(doc);
    const closingFromSummary = this.extractClosingBalance(doc);
    const rawTxns = this.extractRawTransactions(doc);

    const transactions = rawTxns.map((raw, idx) =>
      this.finalizeTxn(raw, idx + 1, openingBalance, rawTxns.slice(0, idx)),
    );

    const closingBalance =
      closingFromSummary ??
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
      text.match(/ACCOUNT\s+NO\s*:?\s*(\d{9,})/i)?.[1] ?? "";

    const periodMatch = text.match(
      /STATEMENT\s+PERIOD\s*:?\s*(\d{4}-\d{2}-\d{2})\s+TO\s+(\d{4}-\d{2}-\d{2})/i,
    );

    const currency = text.match(/CURRENCY\s*:?\s*(\w+)/i)?.[1] ?? "INR";

    return {
      bank: "IDFC",
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

    // Summary header values line (most reliable when present).
    const summary = text.match(
      /Opening\s+Balance\s+Total\s+Debit\s+Total\s+Credit\s+Closing\s+Balance\s+([\d,]+\.\d{2})/i,
    );
    if (summary?.[1]) {
      return parseFloat(summary[1].replace(/,/g, ""));
    }

    // History-row opening balance (skip the summary header itself).
    const rowMatch = text.match(
      /Opening\s+Balance\s+([\d,]+\.\d{2})(?!\s+Total)/i,
    );
    if (rowMatch?.[1]) {
      return parseFloat(rowMatch[1].replace(/,/g, ""));
    }

    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const text = this.normalizeText(doc.rawText);
    const summary = text.match(
      /Opening\s+Balance\s+Total\s+Debit\s+Total\s+Credit\s+Closing\s+Balance\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
    );
    if (summary?.[4]) {
      return parseFloat(summary[4].replace(/,/g, ""));
    }
    return null;
  }

  private extractRawTransactions(doc: ParsedDocument): RawTxn[] {
    const lines: string[] = [];
    for (const page of doc.pages) {
      for (const line of page.lines) {
        const trimmed = line.text.trim();
        if (!trimmed) continue;
        lines.push(trimmed);
      }
    }

    const transactions: RawTxn[] = [];
    let current: RawTxn | null = null;
    let pendingPrefix = "";
    let inHistory = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!;

      if (
        /Value\s+Date/i.test(trimmed) &&
        /Particulars/i.test(trimmed) &&
        /Balance/i.test(trimmed)
      ) {
        inHistory = true;
        continue;
      }

      if (!inHistory) continue;

      if (HEADER_SKIP.some((re) => re.test(trimmed))) {
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
        continue;
      }

      if (current) {
        const next = this.nextSignificantLine(lines, i + 1);
        if (next && TXN_DATE.test(next)) {
          transactions.push(current);
          current = null;
          pendingPrefix = trimmed;
        } else {
          current.narration = `${current.narration} ${trimmed}`.trim();
        }
      } else {
        pendingPrefix = pendingPrefix
          ? `${pendingPrefix} ${trimmed}`
          : trimmed;
      }
    }

    if (current) {
      transactions.push(current);
    }

    return transactions;
  }

  private nextSignificantLine(
    lines: string[],
    from: number,
  ): string | null {
    for (let i = from; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line) continue;
      if (HEADER_SKIP.some((re) => re.test(line))) continue;
      if (FOOTER_MARKERS.some((re) => re.test(line))) return null;
      return line;
    }
    return null;
  }

  private parseTransactionLine(text: string): RawTxn {
    const match = text.match(TXN_LINE);
    if (match) {
      return {
        date: match[1]!,
        narration: (match[3] ?? "").trim(),
        amount: parseFloat(match[4]!.replace(/,/g, "")),
        balance: parseFloat(match[5]!.replace(/,/g, "")),
      };
    }

    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    let afterDate = text.slice(date.length).trim();

    // Strip value date (second DD-MMM-YYYY)
    const valueDateMatch = afterDate.match(
      /^(\d{1,2}-[A-Za-z]{3}-\d{4})\b/,
    );
    if (valueDateMatch) {
      afterDate = afterDate.slice(valueDateMatch[0].length).trim();
    }

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
    const narration =
      lastTwo.length > 0
        ? afterDate.slice(0, lastTwo[0]!.index).trim()
        : afterDate;

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

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }
}

interface RawTxn {
  date: string;
  narration: string;
  amount: number;
  balance: number;
}
