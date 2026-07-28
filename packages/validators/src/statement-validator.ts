import type {
  Validator,
  ParsedStatement,
  ValidationResult,
  ValidationEntry,
} from "@nook/contracts";

export class StatementValidator implements Validator {
  validate(statement: ParsedStatement): ValidationResult {
    const entries: ValidationEntry[] = [
      ...this.structural(statement),
      ...this.financial(statement),
      ...this.semantic(statement),
    ];

    return {
      passed: entries.every((e) => e.passed),
      entries,
    };
  }

  private structural(stmt: ParsedStatement): ValidationEntry[] {
    const entries: ValidationEntry[] = [];

    entries.push({
      category: "structural",
      passed: stmt.metadata.bank.length > 0,
      message: "Bank name present",
    });

    entries.push({
      category: "structural",
      passed:
        stmt.metadata.statementPeriod.from.length > 0 &&
        stmt.metadata.statementPeriod.to.length > 0,
      message: "Statement period present",
    });

    for (const txn of stmt.transactions) {
      if (!txn.date) {
        entries.push({
          category: "structural",
          passed: false,
          message: `Transaction #${txn.sequence} missing date`,
        });
      }
    }

    return entries;
  }

  private financial(stmt: ParsedStatement): ValidationEntry[] {
    const entries: ValidationEntry[] = [];

    const totalDebits = stmt.transactions.reduce(
      (sum, t) => sum + (t.debit ?? 0),
      0,
    );
    const totalCredits = stmt.transactions.reduce(
      (sum, t) => sum + (t.credit ?? 0),
      0,
    );

    const expectedClosing =
      stmt.openingBalance - totalDebits + totalCredits;

    const diff = Math.abs(expectedClosing - stmt.closingBalance);
    const balancesMatch = diff < 0.02; // Tolerance for floating-point

    entries.push({
      category: "financial",
      passed: balancesMatch,
      message: balancesMatch
        ? "Opening + Credits - Debits = Closing"
        : `Balance mismatch: expected ${expectedClosing.toFixed(2)}, got ${stmt.closingBalance.toFixed(2)} (diff: ${diff.toFixed(2)})`,
    });

    return entries;
  }

  private semantic(stmt: ParsedStatement): ValidationEntry[] {
    const entries: ValidationEntry[] = [];

    const from = stmt.metadata.statementPeriod.from;
    const to = stmt.metadata.statementPeriod.to;

    if (from && to) {
      const outOfRange = stmt.transactions.filter((t) => {
        return t.date < from || t.date > to;
      });

      // Allow slight leeway (interest posting on day after period end is common)
      const oneDayAfterTo = this.addDays(to, 1);
      const strictOutOfRange = outOfRange.filter(
        (t) => t.date > oneDayAfterTo,
      );

      entries.push({
        category: "semantic",
        passed: strictOutOfRange.length === 0,
        message:
          strictOutOfRange.length === 0
            ? "All transactions within statement period"
            : `${strictOutOfRange.length} transaction(s) outside statement period`,
      });
    }

    // Duplicate refs only when the same bank reference appears on an
    // identical ledger line (true double-parse). Shared refs across
    // distinct lines are legitimate (e.g. UPI debit + REV-UPI credit).
    const fingerprints = stmt.transactions
      .filter((t) => t.reference.length > 0 && !/^0+$/.test(t.reference))
      .map(
        (t) =>
          `${t.reference}|${t.date}|${t.debit ?? ""}|${t.credit ?? ""}|${t.balance}`,
      );
    const uniqueFingerprints = new Set(fingerprints);
    const duplicateCount = fingerprints.length - uniqueFingerprints.size;
    entries.push({
      category: "semantic",
      passed: duplicateCount === 0,
      message:
        duplicateCount === 0
          ? "No duplicate references"
          : `${duplicateCount} duplicate reference(s)`,
    });

    return entries;
  }

  private addDays(isoDate: string, days: number): string {
    const [yearStr, monthStr, dayStr] = isoDate.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const utcMs = Date.UTC(year, month - 1, day + days);
    return new Date(utcMs).toISOString().slice(0, 10);
  }
}
