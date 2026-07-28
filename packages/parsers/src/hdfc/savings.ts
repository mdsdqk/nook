import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
  DocumentPage,
  TextLine,
} from "@nook/contracts";

/**
 * HDFC Savings statement parser.
 *
 * Layout (from PDF coordinates, x in points from left):
 *   x≈32-38  : Date (DD/MM/YY)
 *   x≈64-68  : Narration (also continuation lines)
 *   x≈230+   : Chq./Ref.No.
 *   x≈310+   : Value Date
 *   x≈370+   : Withdrawal
 *   x≈440+   : Deposit
 *   x≈500+   : Closing Balance
 *
 * Summary section has "STATEMENTSUMMARY" followed by a header line
 * then a values line with: OpeningBalance DrCount CrCount Debits Credits ClosingBal
 */

const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{2}$/;

export class HdfcSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const summary = this.extractSummary(doc);
    const transactions = this.extractTransactions(doc, summary.openingBalance);

    return {
      metadata,
      openingBalance: summary.openingBalance,
      closingBalance: summary.closingBalance,
      transactions,
    };
  }

  private extractMetadata(doc: ParsedDocument): StatementMetadata {
    const text = doc.rawText;

    const accountNo = text.match(/AccountNo\s*:\s*(\d+)/)?.[1] ?? "";
    const currency = text.match(/Currency\s*:\s*(\w+)/)?.[1] ?? "INR";
    const periodMatch = text.match(
      /From\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:\s*(\d{2}\/\d{2}\/\d{4})/,
    );
    const accountTypeRaw = text.match(/AccountType\s*:\s*([^\n]+)/)?.[1] ?? "";

    return {
      bank: "HDFC",
      accountType: /SAVING/i.test(accountTypeRaw) ? "savings" : "unknown",
      accountNumber: accountNo,
      statementPeriod: {
        from: periodMatch?.[1] ?? "",
        to: periodMatch?.[2] ?? "",
      },
      currency,
    };
  }

  private extractSummary(doc: ParsedDocument): {
    openingBalance: number;
    closingBalance: number;
  } {
    for (const page of doc.pages) {
      const summaryIdx = page.lines.findIndex((l) =>
        l.text.includes("STATEMENTSUMMARY"),
      );
      if (summaryIdx === -1) continue;

      // The values line is 2 lines after the header
      for (let i = summaryIdx + 1; i < page.lines.length; i++) {
        const amounts = this.extractAmounts(page.lines[i]!.text);
        // Summary values line has 4+ decimal amounts: opening, debits, credits, closing
        // (DrCount and CrCount are integers, not matched by the decimal pattern)
        if (amounts.length >= 4) {
          return {
            openingBalance: amounts[0]!,
            closingBalance: amounts[amounts.length - 1]!,
          };
        }
      }
    }
    return { openingBalance: 0, closingBalance: 0 };
  }

  private extractTransactions(
    doc: ParsedDocument,
    openingBalance: number,
  ): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    let seq = 0;

    for (const page of doc.pages) {
      // Column header appears on page 1 only. Continuation pages jump
      // straight from account boilerplate into dated transaction rows.
      const headerIdx = page.lines.findIndex(
        (l) =>
          l.text.includes("ClosingBalance") &&
          l.text.includes("Date") &&
          l.text.includes("Narration"),
      );
      const firstTxnIdx = page.lines.findIndex((l) =>
        DATE_PATTERN.test(l.text.trim().split(/\s+/)[0] ?? ""),
      );
      const startIdx = headerIdx !== -1 ? headerIdx + 1 : firstTxnIdx;
      if (startIdx === -1) continue;

      const summaryIdx = page.lines.findIndex((l) =>
        l.text.includes("STATEMENTSUMMARY"),
      );
      // Multi-page statements put bank footer after the last txn on each
      // page (no STATEMENTSUMMARY until the final page).
      const footerIdx = page.lines.findIndex((l) =>
        this.isPageFooter(l.text),
      );
      let endIdx = page.lines.length;
      if (summaryIdx !== -1) endIdx = Math.min(endIdx, summaryIdx);
      if (footerIdx !== -1) endIdx = Math.min(endIdx, footerIdx);
      if (endIdx <= startIdx) continue;

      let currentTxn: RawTxn | null = null;

      for (let i = startIdx; i < endIdx; i++) {
        const line = page.lines[i]!;
        const trimmed = line.text.trim();
        if (!trimmed) continue;

        // Check if this line starts with a date (transaction start)
        const firstToken = trimmed.split(/\s+/)[0] ?? "";
        if (DATE_PATTERN.test(firstToken)) {
          if (currentTxn) {
            seq++;
            transactions.push(
              this.finalizeTxn(currentTxn, seq, openingBalance, transactions),
            );
          }
          currentTxn = this.parseTransactionLine(line, page);
        } else if (currentTxn) {
          // Continuation of narration
          currentTxn.narration += " " + trimmed;
        }
      }

      if (currentTxn) {
        seq++;
        transactions.push(
          this.finalizeTxn(currentTxn, seq, openingBalance, transactions),
        );
      }
    }

    return transactions;
  }

  private isPageFooter(text: string): boolean {
    const trimmed = text.trim();
    return (
      trimmed.includes("HDFCBANKLIMITED") ||
      /^GeneratedOn\s*:/i.test(trimmed) ||
      trimmed.includes("Thisisacomputergeneratedstatement")
    );
  }

  private parseTransactionLine(
    line: TextLine,
    _page: DocumentPage,
  ): RawTxn {
    // Single-span lines — parse from text using regex
    const text = line.text.trim();

    // Extract date (first DD/MM/YY)
    const dateMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+/);
    const date = dateMatch?.[1] ?? "";
    const afterDate = text.substring(dateMatch?.[0].length ?? 0);

    // From the right, extract amounts (comma-formatted with .XX)
    const amountPattern = /[\d,]+\.\d{2}/g;
    const amounts: { value: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = amountPattern.exec(afterDate)) !== null) {
      amounts.push({
        value: parseFloat(m[0].replace(/,/g, "")),
        index: m.index,
      });
    }

    // Extract value date (second DD/MM/YY)
    const valueDateMatch = afterDate.match(
      /\s(\d{2}\/\d{2}\/\d{2})\s/,
    );
    const valueDate = valueDateMatch?.[1] ?? "";

    // Balance is always the last amount
    const balance = amounts.length > 0 ? amounts[amounts.length - 1]!.value : 0;

    // The amount before balance is withdrawal or deposit
    // We'll determine which it is in finalizeTxn using balance delta
    const txnAmount =
      amounts.length >= 2 ? amounts[amounts.length - 2]!.value : 0;

    // Narration is everything between date and the ref/valueDate area
    // Find where ref number starts — it's typically an alphanumeric token before valueDate
    let narration = "";
    let ref = "";

    if (valueDateMatch && valueDateMatch.index !== undefined) {
      const beforeValueDate = afterDate
        .substring(0, valueDateMatch.index)
        .trim();
      // Ref is the last space-separated token before value date
      const tokens = beforeValueDate.split(/\s+/);
      ref = tokens.pop() ?? "";
      narration = tokens.join(" ");
    } else {
      // Fallback: everything before amounts
      const firstAmountIdx =
        amounts.length > 0 ? amounts[0]!.index : afterDate.length;
      narration = afterDate.substring(0, firstAmountIdx).trim();
    }

    return { date, narration, ref, valueDate, amount: txnAmount, balance };
  }

  private finalizeTxn(
    raw: RawTxn,
    seq: number,
    openingBalance: number,
    prevTxns: ParsedTransaction[],
  ): ParsedTransaction {
    // Determine debit/credit from balance delta
    const prevBalance =
      prevTxns.length > 0
        ? prevTxns[prevTxns.length - 1]!.balance
        : openingBalance;

    const delta = raw.balance - prevBalance;
    // Positive delta = credit (deposit), negative = debit (withdrawal)
    const isCredit = delta > 0;

    return {
      date: this.toFullDate(raw.date),
      narration: raw.narration.trim(),
      debit: isCredit ? null : raw.amount,
      credit: isCredit ? raw.amount : null,
      balance: raw.balance,
      // HDFC uses all-zero Chq./Ref.No. as a placeholder (interest, etc.)
      reference: /^0+$/.test(raw.ref) ? "" : raw.ref,
      sequence: seq,
    };
  }

  private toFullDate(ddmmyy: string): string {
    const parts = ddmmyy.split("/");
    if (parts.length !== 3) return ddmmyy;
    const yy = parseInt(parts[2]!, 10);
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
    return `${parts[0]}/${parts[1]}/${yyyy}`;
  }

  private extractAmounts(text: string): number[] {
    const pattern = /[\d,]+\.\d{2}/g;
    const results: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      results.push(parseFloat(match[0].replace(/,/g, "")));
    }
    return results;
  }
}

interface RawTxn {
  date: string;
  narration: string;
  ref: string;
  valueDate: string;
  amount: number;
  balance: number;
}
