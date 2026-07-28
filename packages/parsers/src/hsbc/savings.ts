import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * HSBC India savings statement parser.
 *
 * Layout (text-extractable HSBC India e-statements):
 *   The Hongkong and Shanghai Banking Corporation Limited / HSBC Bank
 *   Account Number / Account No: <n>
 *   Statement Period / From … To … / Statement Date
 *   Date Particulars / Transaction Details Withdrawal Deposit Balance
 *   Opening Balance <amount>
 *   DD/MM/YYYY <narration> <amount> <balance>
 *   Closing Balance <amount>
 *
 * Note: some HSBC India PDFs (including sample_data/savings/hsbc.pdf) embed
 * text as images with no extractable text layer — those need OCR and are
 * out of scope for this text parser.
 *
 * Debit/credit columns are not reliably separated in extracted text, so
 * direction is inferred from the running balance delta.
 */

const TXN_DATE = /^(\d{2}\/\d{2}\/\d{4}|\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/;
const AMOUNT = /[\d,]+\.\d{2}/g;

const FOOTER_MARKERS = [
  /^Closing\s+Balance\b/i,
  /^\*{2,}\s*End\s+of\s+Statement/i,
  /^End\s+of\s+Statement\b/i,
  /^Page\s+\d+\s+of\s+\d+/i,
  /Registered\s+Office\s*:/i,
];

export class HsbcSavingsParser implements StatementParser {
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
      text.match(/Account\s*(?:Number|No\.?)\s*:?\s*(\d{9,})/i)?.[1] ??
      text.match(/\bA\/C\s*(?:No\.?|Number)\s*:?\s*(\d{9,})/i)?.[1] ??
      "";

    const periodMatch =
      text.match(
        /Statement\s*Period\s*:?\s*(\d{1,2}[\/\-\s][A-Za-z0-9]{2,}[\/\-\s]\d{2,4})\s+(?:to|To|-)\s+(\d{1,2}[\/\-\s][A-Za-z0-9]{2,}[\/\-\s]\d{2,4})/i,
      ) ??
      text.match(
        /From\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+To\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      );

    const currency =
      text.match(/Currency\s*:?\s*(INR|Rs\.?)/i)?.[1]?.replace(/Rs\.?/i, "INR") ??
      "INR";

    return {
      bank: "HSBC",
      accountType: "savings",
      accountNumber,
      statementPeriod: {
        from: periodMatch?.[1] ?? "",
        to: periodMatch?.[2] ?? "",
      },
      currency: currency === "INR" ? "INR" : currency,
    };
  }

  private extractOpeningBalance(doc: ParsedDocument): number {
    const match = doc.rawText.match(
      /Opening\s+Balance\s*:?\s*([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const match = doc.rawText.match(
      /Closing\s+Balance\s*:?\s*([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
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
          (/^(?:Tran(?:saction)?\s+)?Date\b/i.test(trimmed) ||
            /\bDate\b/i.test(trimmed)) &&
          (/Particulars/i.test(trimmed) ||
            /Transaction\s+Details/i.test(trimmed) ||
            /Narration/i.test(trimmed) ||
            /Description/i.test(trimmed)) &&
          /Balance/i.test(trimmed)
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
    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    const afterDate = text.slice(dateMatch?.[0].length ?? 0).trim();

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
}

interface RawTxn {
  date: string;
  narration: string;
  amount: number;
  balance: number;
}
