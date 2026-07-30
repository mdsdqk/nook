import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * State Bank of India savings statement parser.
 *
 * Layout (from sample_data/savings/sbi.pdf):
 *   STATEMENT OF ACCOUNT
 *    State Bank of India
 *   Account Number:<n>
 *   Product:REGULAR SB …
 *   IFSC Code:SBIN0…
 *   Currency:INR
 *   Clear Balance:<closing>CR
 *   Statement From :DD-MM-YYYY to DD-MM-YYYY
 *   Balance
 *   <narration type prefix, e.g. POS ATM PURCH / DEP TFR>
 *   DD/MM/YYYY DD/MM/YYYY <ref+particulars> - <debit> - <balance>   (debit)
 *   DD/MM/YYYY DD/MM/YYYY - - <credit> <balance>                   (credit)
 *   DD/MM/YYYY DD/MM/YYYY <particulars> - - <credit> <balance>     (credit)
 *   <narration wrap>
 *   Page no. N
 *   Statement Summary : …
 *   Brought Forward … Closing Balance …
 *   <opening>CR <drCount> <crCount> <totalDebits> <totalCredits> <closing>CR
 *
 * Debit vs credit is explicit via dash placeholders. Narration wraps onto
 * lines before and after the dated amount row. Amounts use Indian grouping
 * (e.g. 1,09,112.09).
 */

const TXN_DATE = /^(\d{2}\/\d{2}\/\d{4})\b/;
const CREDIT_LINE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+-\s+-\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
// Credit with particulars on the amount row: "... INTEREST CREDIT - - 152.00 20,179.27"
const CREDIT_WITH_NARRATION =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+-\s+-\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const DEBIT_LINE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+-\s+([\d,]+\.\d{2})\s+-\s+([\d,]+\.\d{2})\s*$/;
const AMOUNT = /[\d,]+\.\d{2}/g;

const FOOTER_MARKERS = [
  /^Statement\s+Summary\b/i,
  /^Brought\s+Forward\b/i,
  /^Please\s+do\s+not\s+share\s+your\s+ATM/i,
  /^This\s+is\s+a\s+computer\s+generated\s+statement/i,
];

const HEADER_SKIP = [/^Balance$/i];

export class SbiSavingsParser implements StatementParser {
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
      text.match(/Account\s+Number\s*:?\s*(\d{9,})/i)?.[1] ?? "";

    const periodMatch =
      text.match(
        /Statement\s+From\s*:?\s*(\d{2}-\d{2}-\d{4})\s+to\s+(\d{2}-\d{2}-\d{4})/i,
      ) ??
      text.match(
        /Statement\s+Summary\s*:?\s*(\d{2}-\d{2}-\d{4})\s+To\s+(\d{2}-\d{2}-\d{4})/i,
      );

    const currency = text.match(/Currency\s*:?\s*(\w+)/i)?.[1] ?? "INR";

    return {
      bank: "SBI",
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

    // Summary values line after Brought Forward header.
    const summary = text.match(
      /Brought\s+Forward[^\d]*([\d,]+\.\d{2})\s*CR/i,
    );
    if (summary?.[1]) {
      return this.parseAmount(summary[1]);
    }

    // Fallback: values-only line "1,34,095.09CR 15 4 …"
    const values = text.match(
      /([\d,]+\.\d{2})\s*CR\s+\d+\s+\d+\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})\s*CR/i,
    );
    if (values?.[1]) {
      return this.parseAmount(values[1]);
    }

    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const text = this.normalizeText(doc.rawText);

    // Prefer statement-summary closing — Clear Balance is often the live
    // ledger balance at PDF generation time, not the period end.
    const values = text.match(
      /([\d,]+\.\d{2})\s*CR\s+\d+\s+\d+\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})\s*CR/i,
    );
    if (values?.[2]) {
      return this.parseAmount(values[2]);
    }

    const clear = text.match(/Clear\s+Balance\s*:?\s*([\d,]+\.\d{2})\s*CR/i);
    if (clear?.[1]) {
      return this.parseAmount(clear[1]);
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

      if (/Statement\s+From\s*:/i.test(trimmed)) {
        inHistory = true;
        continue;
      }

      if (!inHistory) continue;

      // Page breaks — keep scanning; history continues on next page.
      if (/^Page\s+no\.\s*\d+/i.test(trimmed)) {
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
      if (/^Page\s+no\.\s*\d+/i.test(line)) continue;
      if (HEADER_SKIP.some((re) => re.test(line))) continue;
      if (FOOTER_MARKERS.some((re) => re.test(line))) return null;
      return line;
    }
    return null;
  }

  private parseTransactionLine(text: string): RawTxn {
    const credit = text.match(CREDIT_LINE);
    if (credit) {
      return {
        date: credit[1]!,
        narration: "",
        debit: null,
        credit: this.parseAmount(credit[3]!),
        balance: this.parseAmount(credit[4]!),
      };
    }

    const creditNarr = text.match(CREDIT_WITH_NARRATION);
    if (creditNarr) {
      return {
        date: creditNarr[1]!,
        narration: creditNarr[3]!.trim(),
        debit: null,
        credit: this.parseAmount(creditNarr[4]!),
        balance: this.parseAmount(creditNarr[5]!),
      };
    }

    const debit = text.match(DEBIT_LINE);
    if (debit) {
      return {
        date: debit[1]!,
        narration: debit[3]!.trim(),
        debit: this.parseAmount(debit[4]!),
        credit: null,
        balance: this.parseAmount(debit[5]!),
      };
    }

    // Fallback: last amount = balance; infer direction from dash pattern.
    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    let afterDate = text.slice(date.length).trim();
    const valueDateMatch = afterDate.match(/^(\d{2}\/\d{2}\/\d{4})\b/);
    if (valueDateMatch) {
      afterDate = afterDate.slice(valueDateMatch[0].length).trim();
    }

    const amounts: { value: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(afterDate)) !== null) {
      amounts.push({
        value: this.parseAmount(m[0]),
        index: m.index,
      });
    }

    const lastTwo = amounts.slice(-2);
    const amount = lastTwo[0]?.value ?? 0;
    const balance = lastTwo[1]?.value ?? lastTwo[0]?.value ?? 0;
    const narration =
      lastTwo.length > 0
        ? afterDate
            .slice(0, lastTwo[0]!.index)
            .replace(/^\s*-\s*-\s*/, "")
            .replace(/\s+-\s*-\s*$/, "")
            .replace(/\s+-\s*$/, "")
            .trim()
        : afterDate;

    // Bare "- - amt bal" or narrated "… - - amt bal"
    const isCredit =
      /^\s*-\s*-/.test(afterDate) ||
      /\s-\s-\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s*$/.test(afterDate);
    return {
      date,
      narration,
      debit: isCredit ? null : amount,
      credit: isCredit ? amount : null,
      balance,
    };
  }

  private finalizeTxn(raw: RawTxn, sequence: number): ParsedTransaction {
    return {
      date: raw.date,
      narration: this.normalizeText(raw.narration),
      debit: raw.debit,
      credit: raw.credit,
      balance: raw.balance,
      reference: "",
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
  debit: number | null;
  credit: number | null;
  balance: number;
}
