import type {
  StatementParser,
  ParsedDocument,
  ParsedStatement,
  ParsedTransaction,
  DetectionResult,
  StatementMetadata,
} from "@nook/contracts";

/**
 * IndusInd Indie savings statement parser (product variant: indie_savings).
 *
 * Indie is a digital-native IndusInd product with its own statement layout
 * (downloaded from the INDIE mobile app). Classic IndusInd savings statements
 * should use a separate parser keyed as INDUSIND|savings|<version>.
 *
 * Layout:
 *   Date Particulars Chq No/Ref No Withdrawal Deposit Balance
 *   26 Jul 2026 UPI/... S19929989 0.00 50000.00 558275.69
 *   <narration continuation lines>
 *
 * Transactions appear newest-first; we reverse to chronological order.
 * Opening balance is derived from the oldest transaction + its debit/credit.
 */

const TXN_DATE = /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/;
const TXN_LINE =
  /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+)\s+(\S+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const AMOUNT = /[\d,]+\.\d{2}/g;

const FOOTER_MARKERS = [
  /computer\s+generated\s+statement/i,
  /Registered\s+office\s*:/i,
  /^Acronyms\s*:/i,
  /Grievance\s+Officer/i,
  /downloaded\s+from\s+INDIE/i,
];

export class IndusindIndieSavingsParser implements StatementParser {
  parse(doc: ParsedDocument, _detection: DetectionResult): ParsedStatement {
    const metadata = this.extractMetadata(doc);
    const closingFromSummary = this.extractClosingBalance(doc);
    const rawTxns = this.extractRawTransactions(doc);

    // Statement lists newest first; normalize to chronological order.
    const chronological = [...rawTxns].reverse();
    const transactions = chronological.map((raw, idx) =>
      this.toTransaction(raw, idx + 1),
    );

    const openingBalance =
      transactions.length > 0
        ? this.deriveOpeningBalance(transactions[0]!)
        : 0;
    const closingBalance =
      closingFromSummary ??
      (transactions.length > 0
        ? transactions[transactions.length - 1]!.balance
        : 0);

    return {
      metadata,
      openingBalance,
      closingBalance,
      transactions,
    };
  }

  private extractMetadata(doc: ParsedDocument): StatementMetadata {
    const text = doc.rawText;

    const accountFromSummary = text.match(
      /(\d{10,})\s+INDIE\s+SAVINGS/i,
    )?.[1];
    const accountNumber =
      accountFromSummary ??
      text.match(/Account\s*No\.?\s*[^\d]*(\d{10,})/i)?.[1] ??
      "";

    const periodMatch = text.match(
      /Period:\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i,
    );

    const currency =
      text.match(/INDIE\s+SAVINGS\s+ACCOUNT?\s+(INR)/i)?.[1] ??
      text.match(/\b(INR)\b/)?.[1] ??
      "INR";

    return {
      bank: "INDUSIND",
      accountType: "indie_savings",
      accountNumber,
      statementPeriod: {
        from: periodMatch?.[1] ?? "",
        to: periodMatch?.[2] ?? "",
      },
      currency,
    };
  }

  private extractClosingBalance(doc: ParsedDocument): number | null {
    // Account summary: "<acct> INDIE SAVINGS INR 0.00 <balance>"
    const match = doc.rawText.match(
      /\d{10,}\s+INDIE\s+SAVINGS\s+ACCOUNT?\s+INR\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})/i,
    );
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ""));
    }

    // Line-split form: "... INDIE SAVINGS  INR 0.00 558275.69" then "ACCOUNT"
    const loose = doc.rawText.match(
      /\d{10,}\s+INDIE\s+SAVINGS\s+INR\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})/i,
    );
    if (loose?.[1]) {
      return parseFloat(loose[1].replace(/,/g, ""));
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
          trimmed.includes("Date") &&
          trimmed.includes("Particulars") &&
          trimmed.includes("Balance")
        ) {
          inHistory = true;
          continue;
        }

        if (!inHistory) continue;

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
          // Indie soft-wraps mid-token across lines; join without a space.
          current.narration += trimmed;
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
      const withdrawal = parseFloat(match[4]!.replace(/,/g, ""));
      const deposit = parseFloat(match[5]!.replace(/,/g, ""));
      const balance = parseFloat(match[6]!.replace(/,/g, ""));

      return {
        date: match[1]!,
        narration: match[2]!.trim(),
        reference: match[3]!,
        debit: withdrawal > 0 ? withdrawal : null,
        credit: deposit > 0 ? deposit : null,
        balance,
      };
    }

    // Fallback: date + trailing three amounts; treat middle tokens as narration/ref.
    const dateMatch = text.match(TXN_DATE);
    const date = dateMatch?.[1] ?? "";
    const afterDate = text.slice(date?.length ?? 0).trim();
    const amounts: { value: number; index: number }[] = [];
    let m: RegExpExecArray | null;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(afterDate)) !== null) {
      amounts.push({
        value: parseFloat(m[0].replace(/,/g, "")),
        index: m.index,
      });
    }

    const lastThree = amounts.slice(-3);
    const withdrawal = lastThree[0]?.value ?? 0;
    const deposit = lastThree[1]?.value ?? 0;
    const balance = lastThree[2]?.value ?? 0;
    const beforeAmounts =
      lastThree.length > 0
        ? afterDate.slice(0, lastThree[0]!.index).trim()
        : afterDate;
    const tokens = beforeAmounts.split(/\s+/).filter(Boolean);
    const reference = tokens.pop() ?? "";
    const narration = tokens.join(" ");

    return {
      date,
      narration,
      reference,
      debit: withdrawal > 0 ? withdrawal : null,
      credit: deposit > 0 ? deposit : null,
      balance,
    };
  }

  private toTransaction(raw: RawTxn, sequence: number): ParsedTransaction {
    return {
      date: raw.date,
      narration: raw.narration.trim(),
      debit: raw.debit,
      credit: raw.credit,
      balance: raw.balance,
      reference: raw.reference,
      sequence,
    };
  }

  private deriveOpeningBalance(oldest: ParsedTransaction): number {
    return (
      oldest.balance - (oldest.credit ?? 0) + (oldest.debit ?? 0)
    );
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
