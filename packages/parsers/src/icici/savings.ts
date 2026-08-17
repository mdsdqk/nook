import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * ICICI Bank savings statement parser.
 *
 * Layout (from sample_data/savings/icici.pdf):
 *   Statement of Transactions in Saving Account no. <n> in INR for the period
 *     Month DD, YYYY - Month DD, YYYY
 *   Transaction Withdrawal Deposit Balance
 *   S No. Cheque Number Transaction Remarks
 *   Date Amount (INR) Amount (INR) (INR)
 *   <short counterparty name>
 *   <SNo> DD.MM.YYYY <amount> <balance>
 *   <UPI/... multi-line remarks>
 *
 * Narration prefix (short name) appears on the line before the dated row;
 * UPI remarks wrap onto lines after. Withdrawal vs deposit columns are not
 * reliably separated in extracted text, so direction is inferred from the
 * running balance delta. Opening balance is not printed - derived from the
 * first transaction amount and balance (first txn treated via delta).
 */

const TXN_LINE =
  /^(\d+)\s+(\d{2}\.\d{2}\.\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

const FOOTER_MARKERS = [
  /^www\.icici\.bank\.in/i,
  /^Sincerly,/i,
  /^Team\s+ICICI\s+Bank/i,
  /^Legends\s+for\s+transactions/i,
  /^Please\s+call\s+from\s+your\s+registered/i,
  /^Never\s+share\s+your\s+OTP/i,
  /^This\s+is\s+a\s+system\s+generated\s+statement/i,
];

const HEADER_SKIP = [
  /^Transaction\s+Withdrawal\s+Deposit\s+Balance$/i,
  /^S\s*No\.?\s+Cheque\s+Number/i,
  /^Date\s+Amount\s*\(INR\)/i,
  /^\d+$/,
];

export class IciciSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const rawTxns = this.extractRawTransactions(doc);
    const openingBalance = this.deriveOpeningBalance(rawTxns);

    const transactions = rawTxns.map((raw, idx) =>
      this.finalizeTxn(raw, idx + 1, openingBalance, rawTxns.slice(0, idx)),
    );

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

  private extractMetadata(doc: ParsedDocument): StatementMetadata {
    const text = this.normalizeText(doc.rawText);

    const accountNumber =
      text.match(
        /Statement\s+of\s+Transactions\s+in\s+Saving\s+Account\s+no\.\s*(\d+)/i,
      )?.[1] ?? "";

    const periodMatch = text.match(
      /for\s+the\s+period\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*-\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    );

    const currency = /\bin\s+INR\b/i.test(text) ? "INR" : "INR";

    return {
      bank: "ICICI",
      accountType: "savings",
      accountNumber,
      statementPeriod: {
        from: periodMatch?.[1] ?? "",
        to: periodMatch?.[2] ?? "",
      },
      currency,
    };
  }

  /**
   * Opening balance is not printed. Infer from the first running balance and
   * amount: try debit-first (opening = balance + amount); if a later consecutive
   * delta already implies the first step was a credit, flip.
   */
  private deriveOpeningBalance(rawTxns: RawTxn[]): number {
    if (rawTxns.length === 0) return 0;

    const first = rawTxns[0]!;
    const asDebit = first.balance + first.amount;
    const asCredit = first.balance - first.amount;

    if (rawTxns.length === 1) {
      return asDebit;
    }

    // Both candidates make |delta0| == amount. Prefer the candidate that keeps
    // opening non-negative when only one does; otherwise prefer debit-first
    // (typical for this statement layout's first row).
    if (asDebit >= 0 && asCredit < 0) return asDebit;
    if (asCredit >= 0 && asDebit < 0) return asCredit;
    return asDebit;
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
        /Transaction\s+Withdrawal/i.test(trimmed) &&
        /Deposit/i.test(trimmed) &&
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

      if (TXN_LINE.test(trimmed)) {
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
        if (next && TXN_LINE.test(next)) {
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
        date: match[2]!,
        narration: "",
        amount: parseFloat(match[3]!.replace(/,/g, "")),
        balance: parseFloat(match[4]!.replace(/,/g, "")),
      };
    }

    return { date: "", narration: text, amount: 0, balance: 0 };
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
