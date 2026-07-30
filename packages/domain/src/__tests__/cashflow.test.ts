import { describe, it, expect } from "vitest";
import {
  TRANSACTION_TYPES,
  type TransactionType,
} from "../transaction";
import {
  isSpending,
  isCashflowOut,
  isCashflowIn,
  classifyForDashboard,
} from "../cashflow";

describe("isSpending", () => {
  it("returns true only for expense", () => {
    expect(isSpending("expense")).toBe(true);
  });

  it("returns false for non-lifestyle types", () => {
    expect(isSpending("unclassified_income")).toBe(false);
    expect(isSpending("internal_transfer")).toBe(false);
    expect(isSpending("emi_payment")).toBe(false);
    expect(isSpending("insurance_premium")).toBe(false);
  });
});

describe("isCashflowOut", () => {
  it("returns true for expense, debt, and transfer types", () => {
    expect(isCashflowOut("expense")).toBe(true);
    expect(isCashflowOut("emi_payment")).toBe(true);
    expect(isCashflowOut("internal_transfer")).toBe(true);
    expect(isCashflowOut("tax_payment")).toBe(true);
    expect(isCashflowOut("bank_fee")).toBe(true);
  });

  it("returns false for income-like types", () => {
    expect(isCashflowOut("unclassified_income")).toBe(false);
    expect(isCashflowOut("salary")).toBe(false);
    expect(isCashflowOut("loan_disbursement")).toBe(false);
  });
});

describe("isCashflowIn", () => {
  it("returns true for income types and typical inflows", () => {
    expect(isCashflowIn("unclassified_income")).toBe(true);
    expect(isCashflowIn("salary")).toBe(true);
    expect(isCashflowIn("loan_disbursement")).toBe(true);
    expect(isCashflowIn("investment_redemption")).toBe(true);
  });

  it("returns false for outflows", () => {
    expect(isCashflowIn("expense")).toBe(false);
    expect(isCashflowIn("internal_transfer")).toBe(false);
    expect(isCashflowIn("emi_payment")).toBe(false);
  });
});

describe("classifyForDashboard", () => {
  it("classifies expense as spending", () => {
    expect(classifyForDashboard("expense")).toBe("spending");
  });

  it("classifies income as cashflow_in", () => {
    expect(classifyForDashboard("unclassified_income")).toBe("cashflow_in");
    expect(classifyForDashboard("salary")).toBe("cashflow_in");
  });

  it("classifies emi and transfers as cashflow_out", () => {
    expect(classifyForDashboard("emi_payment")).toBe("cashflow_out");
    expect(classifyForDashboard("internal_transfer")).toBe("cashflow_out");
  });

  it("returns a valid classification for every transaction type", () => {
    const validClassifications = [
      "spending",
      "cashflow_in",
      "cashflow_out",
      "neutral",
    ];
    for (const type of TRANSACTION_TYPES) {
      expect(validClassifications).toContain(classifyForDashboard(type));
    }
  });
});
