import { describe, it, expect, beforeEach } from "vitest";
import { filterTransactions } from "../filters";
import { signedTransactionAmount } from "../format";
import { SEED_ACCOUNTS, SEED_TRANSACTIONS } from "../mock-data";
import { moneyStore } from "../store";
import type { TransactionFilters } from "../types";

const baseFilters: TransactionFilters = {
  type: "all",
  accountId: null,
  cardAccountId: null,
  search: "",
};

describe("signedTransactionAmount", () => {
  it("signs income positive and expense negative", () => {
    expect(signedTransactionAmount("income", 12.5)).toBe(12.5);
    expect(signedTransactionAmount("expense", 12.5)).toBe(-12.5);
  });

  it("signs transfer legs by role", () => {
    expect(signedTransactionAmount("transfer", 100, "out")).toBe(-100);
    expect(signedTransactionAmount("transfer", 100, "in")).toBe(100);
    expect(signedTransactionAmount("transfer", 100)).toBe(-100);
  });
});

describe("filterTransactions", () => {
  it("filters by type", () => {
    const income = filterTransactions(SEED_TRANSACTIONS, SEED_ACCOUNTS, {
      ...baseFilters,
      type: "income",
    });
    expect(income.every((t) => t.type === "income")).toBe(true);
    expect(income.length).toBeGreaterThan(0);
  });

  it("filters by account", () => {
    const rows = filterTransactions(SEED_TRANSACTIONS, SEED_ACCOUNTS, {
      ...baseFilters,
      accountId: "acct_chase_sapphire",
    });
    expect(rows.every((t) => t.accountId === "acct_chase_sapphire")).toBe(
      true,
    );
  });

  it("filters by card account", () => {
    const rows = filterTransactions(SEED_TRANSACTIONS, SEED_ACCOUNTS, {
      ...baseFilters,
      cardAccountId: "acct_chase_sapphire",
    });
    expect(rows.every((t) => t.accountId === "acct_chase_sapphire")).toBe(
      true,
    );
  });

  it("searches type, description, narration, merchant, category", () => {
    const byMerchant = filterTransactions(SEED_TRANSACTIONS, SEED_ACCOUNTS, {
      ...baseFilters,
      search: "netflix",
    });
    expect(byMerchant).toHaveLength(1);
    expect(byMerchant[0]?.merchant).toBe("Netflix");

    const byCategory = filterTransactions(SEED_TRANSACTIONS, SEED_ACCOUNTS, {
      ...baseFilters,
      search: "groceries",
    });
    expect(byCategory.some((t) => t.category === "Groceries")).toBe(true);

    const byNarration = filterTransactions(SEED_TRANSACTIONS, SEED_ACCOUNTS, {
      ...baseFilters,
      search: "ACH CREDIT",
    });
    expect(byNarration.length).toBeGreaterThan(0);
  });
});

describe("moneyStore", () => {
  beforeEach(() => {
    moneyStore.reset();
  });

  it("creates and updates accounts", () => {
    const created = moneyStore.createAccount({
      name: "Cash Wallet",
      type: "asset.wallet",
      currency: "INR",
      balance: 100,
    });
    expect(moneyStore.getSnapshot().accounts).toContainEqual(created);

    const updated = moneyStore.updateAccount(created.id, { balance: 150 });
    expect(updated.balance).toBe(150);
  });

  it("blocks deleting accounts with transactions", () => {
    expect(() => moneyStore.deleteAccount("acct_chase_checking")).toThrow(
      /existing transactions/i,
    );
  });

  it("creates transactions and adjusts balance", () => {
    const before = moneyStore
      .getSnapshot()
      .accounts.find((a) => a.id === "acct_chase_checking")!.balance;

    moneyStore.createTransaction({
      accountId: "acct_chase_checking",
      date: "2026-07-29",
      type: "expense",
      amount: 10,
      description: "Coffee",
      merchant: "Cafe",
      category: "Other",
    });

    const after = moneyStore
      .getSnapshot()
      .accounts.find((a) => a.id === "acct_chase_checking")!.balance;
    expect(after).toBeCloseTo(before - 10);
  });

  it("deletes transactions and reverses balance", () => {
    const before = moneyStore
      .getSnapshot()
      .accounts.find((a) => a.id === "acct_chase_checking")!.balance;

    moneyStore.deleteTransaction("txn_whole_foods");

    const after = moneyStore
      .getSnapshot()
      .accounts.find((a) => a.id === "acct_chase_checking")!.balance;
    expect(after).toBeCloseTo(before + 89.43);
  });
});
