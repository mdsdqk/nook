import { describe, it, expect } from "vitest";
import { StatementValidator } from "../statement-validator";
import type { ParsedStatement } from "@nook/contracts";

function makeStatement(
  overrides: Partial<ParsedStatement> = {},
): ParsedStatement {
  return {
    metadata: {
      bank: "TEST",
      accountType: "savings",
      accountNumber: "1234",
      statementPeriod: { from: "2026-06-01", to: "2026-06-30" },
      currency: "INR",
    },
    openingBalance: 10000,
    closingBalance: 9000,
    transactions: [
      {
        date: "2026-06-15",
        narration: "Test debit",
        debit: 1000,
        credit: null,
        balance: 9000,
        reference: "REF001",
        sequence: 1,
      },
    ],
    ...overrides,
  };
}

describe("StatementValidator", () => {
  const validator = new StatementValidator();

  it("passes valid statement", () => {
    const result = validator.validate(makeStatement());
    expect(result.passed).toBe(true);
  });

  it("fails on balance mismatch", () => {
    const result = validator.validate(
      makeStatement({ closingBalance: 8000 }),
    );
    expect(result.passed).toBe(false);
    const financial = result.entries.find(
      (e) => e.category === "financial",
    );
    expect(financial?.passed).toBe(false);
  });

  it("detects duplicate references", () => {
    const stmt = makeStatement({
      closingBalance: 8000,
      openingBalance: 10000,
      transactions: [
        {
          date: "2026-06-10",
          narration: "A",
          debit: 1000,
          credit: null,
          balance: 9000,
          reference: "DUP",
          sequence: 1,
        },
        {
          date: "2026-06-20",
          narration: "B",
          debit: 1000,
          credit: null,
          balance: 8000,
          reference: "DUP",
          sequence: 2,
        },
      ],
    });
    const result = validator.validate(stmt);
    const semantic = result.entries.find(
      (e) => e.category === "semantic" && e.message.includes("duplicate"),
    );
    expect(semantic?.passed).toBe(false);
  });

  it("fails when no transactions", () => {
    const result = validator.validate(
      makeStatement({
        transactions: [],
        openingBalance: 100,
        closingBalance: 100,
      }),
    );
    const structural = result.entries.find(
      (e) => e.message.includes("At least one"),
    );
    expect(structural?.passed).toBe(false);
  });
});
