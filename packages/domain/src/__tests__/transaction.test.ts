import { describe, it, expect } from "vitest";
import {
  type TransactionType,
  TRANSACTION_TYPE_REGISTRY,
  TRANSACTION_TYPES,
  SUGGESTED_CATEGORIES,
  requiresDestinationAccount,
  isSuggestedCategory,
  isIncomeType,
  isTransferType,
} from "../transaction";

describe("TRANSACTION_TYPE_REGISTRY", () => {
  it("has an entry for every TransactionType union member", () => {
    expect(TRANSACTION_TYPES.length).toBeGreaterThan(20);
    for (const type of TRANSACTION_TYPES) {
      expect(TRANSACTION_TYPE_REGISTRY[type]).toBeDefined();
    }
  });

  it("every entry has required metadata fields", () => {
    for (const type of TRANSACTION_TYPES) {
      const meta = TRANSACTION_TYPE_REGISTRY[type];
      expect(typeof meta.label).toBe("string");
      expect(typeof meta.group).toBe("string");
      expect(typeof meta.affectsNetWorth).toBe("boolean");
      expect(typeof meta.isLifestyleSpending).toBe("boolean");
    }
  });

  it("expense is the only lifestyle spending type", () => {
    const lifestyle = TRANSACTION_TYPES.filter(
      (t) => TRANSACTION_TYPE_REGISTRY[t].isLifestyleSpending,
    );
    expect(lifestyle).toEqual(["expense"]);
  });

  it("internal_transfer does not affect net worth", () => {
    expect(TRANSACTION_TYPE_REGISTRY.internal_transfer.affectsNetWorth).toBe(
      false,
    );
  });

  it("unclassified_income is in the income group", () => {
    expect(isIncomeType("unclassified_income")).toBe(true);
    expect(TRANSACTION_TYPE_REGISTRY.unclassified_income.group).toBe("income");
  });
});

describe("requiresDestinationAccount", () => {
  it("returns true only for internal_transfer", () => {
    expect(requiresDestinationAccount("internal_transfer")).toBe(true);
  });

  it("returns false for other types", () => {
    expect(requiresDestinationAccount("expense")).toBe(false);
    expect(requiresDestinationAccount("unclassified_income")).toBe(false);
    expect(requiresDestinationAccount("emi_payment")).toBe(false);
    expect(requiresDestinationAccount("friend_loan")).toBe(false);
  });
});

describe("group helpers", () => {
  it("isTransferType covers transfer group", () => {
    expect(isTransferType("internal_transfer")).toBe(true);
    expect(isTransferType("friend_loan")).toBe(true);
    expect(isTransferType("expense")).toBe(false);
  });
});

describe("SUGGESTED_CATEGORIES", () => {
  it("includes common budgeting labels", () => {
    expect(SUGGESTED_CATEGORIES).toEqual(
      expect.arrayContaining([
        "Food",
        "Groceries",
        "Subscriptions",
        "Transport",
        "Housing",
      ]),
    );
  });

  it("isSuggestedCategory accepts known labels only", () => {
    expect(isSuggestedCategory("Groceries")).toBe(true);
    expect(isSuggestedCategory("Unknown")).toBe(false);
  });
});

// Exhaustiveness check: adding a type without registry entry fails to compile
function _assertRegistryComplete(
  _type: TransactionType,
): (typeof TRANSACTION_TYPE_REGISTRY)[TransactionType] {
  return TRANSACTION_TYPE_REGISTRY[_type];
}
void _assertRegistryComplete;
