import { describe, it, expect } from "vitest";
import type { TransactionType } from "../transaction";
import {
  isSpending,
  isCashflowOut,
  isCashflowIn,
  classifyForDashboard,
} from "../cashflow";

const ALL_TYPES: TransactionType[] = [
  "income",
  "expense",
  "transfer",
  "obligation",
];

describe("isSpending", () => {
  it("returns true only for expense", () => {
    expect(isSpending("expense")).toBe(true);
  });

  it("returns false for all other types", () => {
    expect(isSpending("income")).toBe(false);
    expect(isSpending("transfer")).toBe(false);
    expect(isSpending("obligation")).toBe(false);
  });
});

describe("isCashflowOut", () => {
  it("returns true for expense, obligation, and transfer", () => {
    expect(isCashflowOut("expense")).toBe(true);
    expect(isCashflowOut("obligation")).toBe(true);
    expect(isCashflowOut("transfer")).toBe(true);
  });

  it("returns false for income", () => {
    expect(isCashflowOut("income")).toBe(false);
  });
});

describe("isCashflowIn", () => {
  it("returns true only for income", () => {
    expect(isCashflowIn("income")).toBe(true);
  });

  it("returns false for all other types", () => {
    expect(isCashflowIn("expense")).toBe(false);
    expect(isCashflowIn("transfer")).toBe(false);
    expect(isCashflowIn("obligation")).toBe(false);
  });
});

describe("classifyForDashboard", () => {
  it("classifies expense as spending", () => {
    expect(classifyForDashboard("expense")).toBe("spending");
  });

  it("classifies income as cashflow_in", () => {
    expect(classifyForDashboard("income")).toBe("cashflow_in");
  });

  it("classifies obligation as cashflow_out", () => {
    expect(classifyForDashboard("obligation")).toBe("cashflow_out");
  });

  it("classifies transfer as cashflow_out", () => {
    expect(classifyForDashboard("transfer")).toBe("cashflow_out");
  });

  it("returns a valid classification for every transaction type", () => {
    const validClassifications = [
      "spending",
      "cashflow_in",
      "cashflow_out",
      "neutral",
    ];
    for (const type of ALL_TYPES) {
      expect(validClassifications).toContain(classifyForDashboard(type));
    }
  });
});
