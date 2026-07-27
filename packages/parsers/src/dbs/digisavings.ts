import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * DBS digibank DigiSavings statement parser.
 *
 * Layout (transaction page):
 *   Account No.: <n> Account Type: DIGISAVINGS
 *   Statement Period: DD-MMM-YYYY To DD-MMM-YYYY Currency: INR
 *   Transaction Date Value Date Details of transaction Debit Credit Balance
 *   Opening Balance     <amount>
 *   30-Jun-2026 30-Jun-2026 CREDIT INTEREST - Saving   92.00 14,800.57
 *   <narration continuation>
 *   Closing Balance <amount>
 *   *** End of Statement ***
 *
 * Debit/credit columns are not reliably separated in extracted text, so
 * direction is inferred from the running balance delta.
 */

const TXN_DATE = /^(\d{1,2}-[A-Za-z]{3}-\d{4})\b/;
const TXN_LINE =
  /^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const AMOUNT = /[\d,]+\.\d{2}/g;

const FOOTER_MARKERS = [
  /^\*{3}\s*End of Statement/i,
  /^Closing Balance\b/i,
];

export class DbsDigisavingsParser implements StatementParser {
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
      text.match(/Account\s*No\.?\s*:\s*(\d{10,})/i)?.[1] ??
      text.match(/\bSAVINGS\s+(\d{10,})\s+INR\b/i)?.[1] ??
      "";

    const periodMatch = text.match(
      /Statement\s*Period\s*:?\s*(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(?:To|to)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i,
    );

    const currency =
      text.match(/Currency\s*:\s*(INR)/i)?.[1] ??
      text.match(/\bSAVINGS\s+\d+\s+(INR)\b/i)?.[1] ??
      "INR";

    return {
      bank: "DBS",
      accountType: "digisavings",
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
      /Opening\s+Balance\s+([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const match = doc.rawText.match(
      /Closing\s+Balance\s+([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }

    // Summary line: "SAVINGS <acct> INR <balance> ACTIVE"
    const summary = doc.rawText.match(
      /\bSAVINGS\s+\d+\s+INR\s+([\d,]+\.\d{2})\s+ACTIVE\b/i,
    );
    if (summary?.[1]) {
      return parseFloat(summary[1].replace(/,/g, ""));
    }

    return null;
  }

  private extractRawTransactions(doc: ParsedDocument): RawTxn[] {
    const transactions: RawTxn[] = [];
    let current: RawTxn | null = null;
    let inHistory = false;

    for (const page of doc.pages) {
      for (const line of page.lines) {
        const trimmed = line.text.trim();
        if (!trimmed) continue;

        if (
          trimmed.includes("Transaction Date") &&
          trimmed.includes("Details of transaction") &&
          trimmed.includes("Balance")
        ) {
          inHistory = true;
          continue;
        }

        if (!inHistory) continue;

        if (/^Opening\s+Balance\b/i.test(trimmed)) {
          continue;
        }

        if (FOOTER_MARKERS.some((re) => re.test(trimmed))) {
          if (current) {
            transactions.push(current);
            current = null;
          }
          inHistory = false;
          continue;
        }

        if (TXN_DATE.test(trimmed)) {
          if (current) {
            transactions.push(current);
          }
          current = this.parseTransactionLine(trimmed);
        } else if (current) {
          current.narration += " " + trimmed;
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
        valueDate: match[2]!,
        narration: match[3]!.trim(),
        amount: parseFloat(match[4]!.replace(/,/g, "")),
        balance: parseFloat(match[5]!.replace(/,/g, "")),
      };
    }

    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    const afterDate = text.slice(date.length).trim();
    const valueDateMatch = afterDate.match(
      /^(\d{1,2}-[A-Za-z]{3}-\d{4})\b/,
    );
    const valueDate = valueDateMatch?.[1] ?? "";
    const afterValueDate = valueDate
      ? afterDate.slice(valueDate.length).trim()
      : afterDate;

    const amounts: { value: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(afterValueDate)) !== null) {
      amounts.push({
        value: parseFloat(m[0].replace(/,/g, "")),
        index: m.index,
      });
    }

    const lastTwo = amounts.slice(-2);
    const amount = lastTwo[0]?.value ?? 0;
    const balance = lastTwo[1]?.value ?? 0;
    const narration =
      lastTwo.length > 0
        ? afterValueDate.slice(0, lastTwo[0]!.index).trim()
        : afterValueDate;

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
}

interface RawTxn {
  date: string;
  valueDate: string;
  narration: string;
  amount: number;
  balance: number;
}
