import type { Normalizer, ParsedStatement, ParsedTransaction } from "@nook/contracts";
import { toISODate, cleanWhitespace } from "@nook/shared";

export class StatementNormalizer implements Normalizer {
  normalize(statement: ParsedStatement): ParsedStatement {
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        statementPeriod: {
          from: this.normalizeDate(statement.metadata.statementPeriod.from),
          to: this.normalizeDate(statement.metadata.statementPeriod.to),
        },
      },
      transactions: statement.transactions.map((txn) =>
        this.normalizeTxn(txn),
      ),
    };
  }

  private normalizeTxn(txn: ParsedTransaction): ParsedTransaction {
    return {
      ...txn,
      date: this.normalizeDate(txn.date),
      narration: cleanWhitespace(txn.narration),
    };
  }

  private normalizeDate(raw: string): string {
    const cleaned = raw.trim();
    if (!cleaned) {
      return "";
    }
    return toISODate(cleaned);
  }
}
