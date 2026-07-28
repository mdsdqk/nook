import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * HSBC Premier savings statement parser.
 *
 * Layout (from sample_data/savings/hsbc-savings.pdf):
 *   SAVINGS ACCOUNT-RES <account-no>
 *   Date Transaction Details Deposits Withdrawals Balance
 *   Balance Brought Forward <amount>
 *   <DDMonYYYY> <narration-start>
 *   <wrapped narration lines>
 *   <value/trace line> <amount> <balance>
 *   ...
 *   CLOSING BALANCE <amount>
 *
 * Debit/credit columns are not reliably aligned in extracted text, so
 * direction is inferred from running balance deltas.
 */

const TXN_DATE_COMPACT = /^(\d{1,2}[A-Za-z]{3}\d{2,4})\b/;
const DATE_EMBEDDED = /\b(\d{1,2}[A-Za-z]{3}\d{2,4})\b/;
const TRAILING_AMOUNT_PAIR = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

const HISTORY_HEADER =
  /^Date\s+Transaction\s+Details\s+Deposits\s+Withdrawals\s+Balance$/i;

const HISTORY_SKIP = [
  /^SAVINGS\s+ACCOUNT-RES\b/i,
  /^Nominee\s+Registered\b/i,
  /^MICR\s+CODE\b/i,
  /^IFSC\s+CODE\b/i,
  /^\(DR=Debit\)\s*$/i,
  /^INR\s*$/i,
  /^Balance\s+Brought\s+Forward\b/i,
  /^Balance\s+Carried\s+Forward\b/i,
  /^Page\s+\d+\s+of\s+\d+/i,
];

const HISTORY_END = [/^CLOSING\s+BALANCE\b/i, /^Transaction\s+Turnover\b/i];

export class HsbcSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const openingBalance = this.extractOpeningBalance(doc);
    const rawTxns = this.extractRawTransactions(doc);
    const metadata = this.extractMetadata(doc, rawTxns);
    const closingFromLine = this.extractClosingBalance(doc);

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

  private extractMetadata(
    doc: ParsedDocument,
    transactions: RawTxn[],
  ): StatementMetadata {
    const text = doc.rawText;

    const accountNumber =
      text.match(/SAVINGS\s+ACCOUNT-RES\s+([0-9-]+)/i)?.[1] ??
      text.match(/Account\s*(?:Number|No\.?)\s*:?\s*([0-9-]+)/i)?.[1] ??
      text.match(/\bA\/C\s*(?:No\.?|Number)\s*:?\s*([0-9-]+)/i)?.[1] ??
      "";

    const periodMatch =
      text.match(
        /Statement\s*Period\s*:?\s*(\d{1,2}[\/\-\s][A-Za-z0-9]{2,}[\/\-\s]\d{2,4})\s+(?:to|To|-)\s+(\d{1,2}[\/\-\s][A-Za-z0-9]{2,}[\/\-\s]\d{2,4})/i,
      ) ??
      text.match(
        /From\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+To\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      );

    const fallbackFrom =
      transactions.length > 0 ? transactions[0]!.date : "";
    const fallbackTo =
      transactions.length > 0 ? transactions[transactions.length - 1]!.date : "";

    const currency =
      text.match(/Currency\s*:?\s*(INR|Rs\.?)/i)?.[1]?.replace(/Rs\.?/i, "INR") ??
      "INR";

    return {
      bank: "HSBC",
      accountType: "savings",
      accountNumber,
      statementPeriod: {
        from: periodMatch?.[1] ?? fallbackFrom,
        to: periodMatch?.[2] ?? fallbackTo,
      },
      currency: currency === "INR" ? "INR" : currency,
    };
  }

  private extractOpeningBalance(doc: ParsedDocument): number {
    const broughtForward = doc.rawText.match(
      /BALANCE\s+BROUGHT\s+FORWARD\s*([\d,]+\.\d{2})/i,
    );
    if (broughtForward?.[1]) {
      return this.parseAmount(broughtForward[1]);
    }

    const openingBalance = doc.rawText.match(
      /Opening\s+Balance\s*:?\s*([\d,]+\.\d{2})/i,
    );
    if (openingBalance?.[1]) {
      return this.parseAmount(openingBalance[1]);
    }
    return 0;
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    const match = doc.rawText.match(
      /CLOSING\s+BALANCE\s*:?\s*([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return this.parseAmount(match[1]);
    }
    return null;
  }

  private extractRawTransactions(doc: ParsedDocument): RawTxn[] {
    const transactions: RawTxn[] = [];
    let inHistory = false;
    let currentDate = "";
    let currentNarrationParts: string[] = [];
    let lastSeenTxnDate = "";

    const flushCurrent = (amount: number, balance: number) => {
      const chosenDate =
        currentDate ||
        this.extractEmbeddedCompactDate(currentNarrationParts.join(" ")) ||
        lastSeenTxnDate;
      if (!chosenDate) {
        currentNarrationParts = [];
        return;
      }

      const narration = currentNarrationParts.join(" ").trim();
      transactions.push({
        date: chosenDate,
        narration,
        amount,
        balance,
      });

      lastSeenTxnDate = chosenDate;
      currentDate = "";
      currentNarrationParts = [];
    };

    for (const page of doc.pages) {
      for (const line of page.lines) {
        const trimmed = line.text.trim();
        if (!trimmed) continue;

        if (HISTORY_HEADER.test(trimmed)) {
          inHistory = true;
          continue;
        }

        if (!inHistory) continue;

        if (HISTORY_SKIP.some((re) => re.test(trimmed))) {
          continue;
        }

        if (/BALANCE\s+BROUGHT\s+FORWARD/i.test(trimmed)) {
          currentDate = "";
          currentNarrationParts = [];
          continue;
        }

        if (HISTORY_END.some((re) => re.test(trimmed))) {
          const amountPair = this.extractTrailingAmountPair(trimmed);
          if (amountPair) {
            const [amount, balance] = amountPair;
            flushCurrent(amount, balance);
          }
          inHistory = false;
          continue;
        }

        const dateMatch = trimmed.match(TXN_DATE_COMPACT);
        if (dateMatch?.[1]) {
          currentDate = this.normalizeCompactDate(dateMatch[1]);
          if (currentDate) {
            lastSeenTxnDate = currentDate;
          }
          const afterDate = trimmed.slice(dateMatch[0].length).trim();
          if (afterDate) {
            currentNarrationParts.push(afterDate);
          }
        } else {
          currentNarrationParts.push(trimmed);
        }

        const candidate = currentNarrationParts.join(" ").trim();
        const amountPair = this.extractTrailingAmountPair(candidate);
        if (amountPair) {
          const [amount, balance] = amountPair;
          const narrationWithoutAmounts = candidate
            .replace(TRAILING_AMOUNT_PAIR, "")
            .trim();
          currentNarrationParts = narrationWithoutAmounts
            ? [narrationWithoutAmounts]
            : [];
          flushCurrent(amount, balance);
        }
      }
    }

    return transactions;
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

  private extractTrailingAmountPair(text: string): [number, number] | null {
    const match = text.match(TRAILING_AMOUNT_PAIR);
    if (!match?.[1] || !match[2]) return null;
    return [this.parseAmount(match[1]), this.parseAmount(match[2])];
  }

  private extractEmbeddedCompactDate(text: string): string {
    const match = text.match(DATE_EMBEDDED);
    if (!match?.[1]) return "";
    return this.normalizeCompactDate(match[1]);
  }

  private normalizeCompactDate(raw: string): string {
    const m = raw.match(/^(\d{1,2})([A-Za-z]{3})(\d{2,4})$/);
    if (!m) return "";

    const dd = m[1]!.padStart(2, "0");
    const mon = this.toTitleCaseMonth(m[2]!);
    const year = m[3]!;
    const yyyy =
      year.length === 4
        ? year
        : String(
            (parseInt(year, 10) > 50 ? 1900 : 2000) + parseInt(year, 10),
          );

    return `${dd} ${mon} ${yyyy}`;
  }

  private toTitleCaseMonth(raw: string): string {
    const lower = raw.toLowerCase();
    return lower[0]!.toUpperCase() + lower.slice(1, 3);
  }

  private parseAmount(raw: string): number {
    return parseFloat(raw.replace(/,/g, ""));
  }
}

interface RawTxn {
  date: string;
  narration: string;
  amount: number;
  balance: number;
}
