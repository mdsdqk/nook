import type { Normalizer, ParsedStatement, ParsedTransaction } from "@nook/contracts";
import { toISODate, cleanWhitespace } from "@nook/shared";

export class StatementNormalizer implements Normalizer {
  normalize(statement: ParsedStatement): ParsedStatement {
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        statementPeriod: {
          from: toISODate(statement.metadata.statementPeriod.from),
          to: toISODate(statement.metadata.statementPeriod.to),
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
      date: toISODate(txn.date),
      narration: cleanWhitespace(txn.narration),
    };
  }
}
