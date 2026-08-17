import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * Kotak Mahindra Bank 811 (digital) savings statement parser.
 *
 * Layout (from sample_data/savings/kotak-811.pdf):
 *   Account Statement
 *   DD MMM YYYY - DD MMM YYYY
 *   Account No. <n>
 *   Account Type  Savings
 *   CRN …
 *   Currency INDIAN RUPEE
 *   MICR … IFSC Code KKBK0…
 *   Savings Account Transactions
 *   # Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance
 *   - - Opening Balance - - - <amount>
 *   <n> DD MMM YYYY <description> <ref> <withdrawal|-|> <deposit|-|> <balance>
 *   Statement Generated on … Page N of …
 *   Account Summary
 *   Savings Account (SA): <opening> <closing>
 *   End of Statement
 *   Kotak Mahindra Bank Ltd. … www.kotak.bank.in
 *
 * Withdrawal/deposit columns may use `-` for empty. Narration may wrap.
 * Sample period can contain zero transactions (opening == closing).
 */

const TXN_START = /^(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/;
const TXN_LINE =
  /^(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(?:([\d,]+\.\d{2})|-)\s+(?:([\d,]+\.\d{2})|-)\s+([\d,]+\.\d{2})\s*$/;
const AMOUNT_OR_DASH = /([\d,]+\.\d{2}|-)/g;

const FOOTER_MARKERS = [
  /^Account\s+Summary\b/i,
  /^End\s+of\s+Statement\b/i,
  /^Any\s+discrepancy\s+in\s+the\s+statement/i,
  /^Kotak\s+Mahindra\s+Bank\s+Ltd/i,
  /^Important\s+Information\b/i,
  /^Commonly\s+Used\s+Narrations\b/i,
];

const HEADER_SKIP = [
  /^#\s*Date\s+Description/i,
  /^Opening\s+Balance\b/i,
  /^-\s+-\s+Opening\s+Balance\b/i,
];

export class Kotak811SavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const openingBalance = this.extractOpeningBalance(doc);
    const closingFromDoc = this.extractClosingBalance(doc);
    const rawTxns = this.extractRawTransactions(doc);

    const transactions = rawTxns.map((raw, idx) =>
      this.finalizeTxn(raw, idx + 1),
    );

    const closingBalance =
      closingFromDoc ??
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
      text.match(/Account\s+No\.?\s*:?\s*(\d{9,})/i)?.[1] ?? "";

    const periodMatch = text.match(
      /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/,
    );

    const currencyRaw =
      text.match(/Currency\s+([A-Za-z][A-Za-z\s]*?)(?=\s+MICR|\s+IFSC|\s+Karnataka|$)/i)?.[1]?.trim() ??
      text.match(/Currency\s+(\w+)/i)?.[1] ??
      "INR";
    const currency = /INDIAN\s+RUPEE/i.test(currencyRaw)
      ? "INR"
      : currencyRaw.split(/\s+/)[0] ?? "INR";

    return {
      bank: "KOTAK",
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

    const openingRow = text.match(
      /Opening\s+Balance(?:\s+-)*\s+([\d,]+\.\d{2})/i,
    );
    if (openingRow?.[1]) {
      return this.parseAmount(openingRow[1]);
    }

    const summary = text.match(
      /Savings\s+Account\s*\(SA\)\s*:?\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
    );
    if (summary?.[1]) {
      return this.parseAmount(summary[1]);
    }

    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const text = this.normalizeText(doc.rawText);

    const summary = text.match(
      /Savings\s+Account\s*\(SA\)\s*:?\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
    );
    if (summary?.[2]) {
      return this.parseAmount(summary[2]);
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
        /Savings\s+Account\s+Transactions/i.test(trimmed) ||
        (/#\s*Date/i.test(trimmed) &&
          /Withdrawal/i.test(trimmed) &&
          /Balance/i.test(trimmed))
      ) {
        inHistory = true;
        continue;
      }

      if (!inHistory) continue;

      // Per-page footer - history may continue on later pages.
      if (/^Statement\s+Generated\s+on/i.test(trimmed)) {
        continue;
      }

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

      if (TXN_START.test(trimmed)) {
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
        if (next && TXN_START.test(next)) {
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
      if (/^Statement\s+Generated\s+on/i.test(line)) continue;
      if (HEADER_SKIP.some((re) => re.test(line))) continue;
      if (FOOTER_MARKERS.some((re) => re.test(line))) return null;
      return line;
    }
    return null;
  }

  private parseTransactionLine(text: string): RawTxn {
    const match = text.match(TXN_LINE);
    if (match) {
      const withdrawal =
        match[4] !== undefined ? this.parseAmount(match[4]) : 0;
      const deposit =
        match[5] !== undefined ? this.parseAmount(match[5]) : 0;
      const { narration, reference } = this.splitNarrationRef(match[3]!);

      return {
        date: match[2]!,
        narration,
        reference,
        debit: withdrawal > 0 ? withdrawal : null,
        credit: deposit > 0 ? deposit : null,
        balance: this.parseAmount(match[6]!),
      };
    }

    const start = text.match(TXN_START);
    const date = start?.[2] ?? "";
    const after = start
      ? text.slice(start[0].length).trim()
      : text;

    // Walk trailing withdrawal/deposit/balance tokens (amount or "-").
    const tokens: { raw: string; index: number }[] = [];
    let m: RegExpExecArray | null;
    AMOUNT_OR_DASH.lastIndex = 0;
    while ((m = AMOUNT_OR_DASH.exec(after)) !== null) {
      tokens.push({ raw: m[1]!, index: m.index });
    }

    const lastThree = tokens.slice(-3);
    const withdrawalRaw = lastThree[0]?.raw ?? "-";
    const depositRaw = lastThree[1]?.raw ?? "-";
    const balanceRaw = lastThree[2]?.raw ?? "0.00";

    const withdrawal =
      withdrawalRaw === "-" ? 0 : this.parseAmount(withdrawalRaw);
    const deposit = depositRaw === "-" ? 0 : this.parseAmount(depositRaw);
    const balance =
      balanceRaw === "-" ? 0 : this.parseAmount(balanceRaw);

    const before =
      lastThree.length > 0
        ? after.slice(0, lastThree[0]!.index).trim()
        : after;
    const { narration, reference } = this.splitNarrationRef(before);

    return {
      date,
      narration,
      reference,
      debit: withdrawal > 0 ? withdrawal : null,
      credit: deposit > 0 ? deposit : null,
      balance,
    };
  }

  private splitNarrationRef(text: string): {
    narration: string;
    reference: string;
  } {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return { narration: "", reference: "" };
    }
    if (tokens.length === 1) {
      return { narration: tokens[0]!, reference: "" };
    }
    const reference = tokens.pop()!;
    // Bare "-" placeholders are not references.
    if (reference === "-") {
      return { narration: tokens.join(" "), reference: "" };
    }
    return { narration: tokens.join(" "), reference };
  }

  private finalizeTxn(raw: RawTxn, sequence: number): ParsedTransaction {
    return {
      date: raw.date,
      narration: this.normalizeText(raw.narration),
      debit: raw.debit,
      credit: raw.credit,
      balance: raw.balance,
      reference: raw.reference,
      sequence,
    };
  }

  private parseAmount(raw: string): number {
    return parseFloat(raw.replace(/,/g, ""));
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }
}

interface RawTxn {
  date: string;
  narration: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}
