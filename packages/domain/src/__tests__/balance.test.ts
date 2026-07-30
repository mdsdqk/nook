import { describe, it, expect } from "vitest";
import type { BalanceAssertion } from "../assertion";
import {
  type LedgerTransaction,
  type NetWorthAccount,
  computeTransactionEffect,
  computeAccountBalance,
  computeNetWorth,
} from "../balance";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";
const UNRELATED = "account-unrelated";

describe("computeTransactionEffect", () => {
  it("credit increases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 1000,
      date: "2026-03-01",
      direction: "credit",
      type: "unclassified_income",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(1000);
  });

  it("credit has no effect on unrelated account", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 1000,
      date: "2026-03-01",
      direction: "credit",
      type: "salary",
    };
    expect(computeTransactionEffect(tx, UNRELATED)).toBe(0);
  });

  it("debit decreases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 500,
      date: "2026-03-01",
      direction: "debit",
      type: "expense",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(-500);
  });

  it("emi debit decreases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 2000,
      date: "2026-03-01",
      direction: "debit",
      type: "emi_payment",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(-2000);
  });

  it("collapsed internal_transfer decreases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: 300,
      date: "2026-03-01",
      direction: "debit",
      type: "internal_transfer",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(-300);
  });

  it("collapsed internal_transfer increases destination account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: 300,
      date: "2026-03-01",
      direction: "debit",
      type: "internal_transfer",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_B)).toBe(300);
  });

  it("collapsed internal_transfer has no effect on unrelated account", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: 300,
      date: "2026-03-01",
      direction: "debit",
      type: "internal_transfer",
    };
    expect(computeTransactionEffect(tx, UNRELATED)).toBe(0);
  });
});

describe("computeAccountBalance", () => {
  it("returns 0 when no assertions and no transactions", () => {
    expect(computeAccountBalance([], [], ACCOUNT_A, "2026-03-15")).toBe(0);
  });

  it("returns assertion balance when only assertion exists (no txns after)", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 5000 },
    ];
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-03-15"),
    ).toBe(5000);
  });

  it("returns assertion balance + delta from subsequent transactions", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 5000 },
    ];
    const txns: LedgerTransaction[] = [
      {
        accountId: ACCOUNT_A,
        amount: 200,
        date: "2026-03-05",
        direction: "debit",
        type: "expense",
      },
      {
        accountId: ACCOUNT_A,
        amount: 1000,
        date: "2026-03-10",
        direction: "credit",
        type: "unclassified_income",
      },
    ];
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-15"),
    ).toBe(5800);
  });

  it("snaps to most recent assertion before asOfDate", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-01-01", balance: 1000 },
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 8000 },
    ];
    const txns: LedgerTransaction[] = [
      {
        accountId: ACCOUNT_A,
        amount: 500,
        date: "2026-02-15",
        direction: "credit",
        type: "unclassified_income",
      },
      {
        accountId: ACCOUNT_A,
        amount: 100,
        date: "2026-03-05",
        direction: "debit",
        type: "expense",
      },
    ];
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-15"),
    ).toBe(7900);
  });

  it("handles query date exactly on an assertion date", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 5000 },
    ];
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-03-01"),
    ).toBe(5000);
  });

  it("ignores assertions for other accounts", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_B, date: "2026-03-01", balance: 9999 },
    ];
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-03-15"),
    ).toBe(0);
  });

  it("handles backdated transaction between two assertions", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-01-01", balance: 1000 },
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 5000 },
    ];
    const txns: LedgerTransaction[] = [
      {
        accountId: ACCOUNT_A,
        amount: 200,
        date: "2026-02-15",
        direction: "debit",
        type: "expense",
      },
    ];
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-02-15"),
    ).toBe(800);
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-15"),
    ).toBe(5000);
  });

  it("handles gap with no transactions between assertions (snapping)", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-01-01", balance: 1000 },
      { accountId: ACCOUNT_A, date: "2026-06-01", balance: 3000 },
    ];
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-03-15"),
    ).toBe(1000);
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-07-01"),
    ).toBe(3000);
  });

  it("returns sum of deltas when query is before any assertion", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-06-01", balance: 5000 },
    ];
    const txns: LedgerTransaction[] = [
      {
        accountId: ACCOUNT_A,
        amount: 1000,
        date: "2026-03-01",
        direction: "credit",
        type: "unclassified_income",
      },
      {
        accountId: ACCOUNT_A,
        amount: 200,
        date: "2026-03-10",
        direction: "debit",
        type: "expense",
      },
    ];
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-15"),
    ).toBe(800);
  });

  it("handles transactions on the same date as an assertion", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 5000 },
    ];
    const txns: LedgerTransaction[] = [
      {
        accountId: ACCOUNT_A,
        amount: 100,
        date: "2026-03-01",
        direction: "debit",
        type: "expense",
      },
    ];
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-03-01"),
    ).toBe(5000);
  });

  it("handles multiple transactions of different types", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-03-01", balance: 10000 },
    ];
    const txns: LedgerTransaction[] = [
      {
        accountId: ACCOUNT_A,
        amount: 5000,
        date: "2026-03-05",
        direction: "credit",
        type: "unclassified_income",
      },
      {
        accountId: ACCOUNT_A,
        amount: 2000,
        date: "2026-03-10",
        direction: "debit",
        type: "expense",
      },
      {
        accountId: ACCOUNT_A,
        toAccountId: ACCOUNT_B,
        amount: 1000,
        date: "2026-03-12",
        direction: "debit",
        type: "internal_transfer",
      },
      {
        accountId: ACCOUNT_A,
        amount: 500,
        date: "2026-03-14",
        direction: "debit",
        type: "emi_payment",
      },
    ];
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-15"),
    ).toBe(11500);
  });
});

describe("computeNetWorth", () => {
  it("returns 0 for empty list", () => {
    expect(computeNetWorth([])).toBe(0);
  });

  it("sums asset balances positively", () => {
    const accounts: NetWorthAccount[] = [
      { type: "asset.bank", balance: 5000 },
      { type: "asset.cash", balance: 1000 },
    ];
    expect(computeNetWorth(accounts)).toBe(6000);
  });

  it("subtracts liability balances", () => {
    const accounts: NetWorthAccount[] = [
      { type: "liability.credit_card", balance: 2000 },
      { type: "liability.loan", balance: 10000 },
    ];
    expect(computeNetWorth(accounts)).toBe(-12000);
  });

  it("computes net worth as assets minus liabilities", () => {
    const accounts: NetWorthAccount[] = [
      { type: "asset.bank", balance: 50000 },
      { type: "asset.investment", balance: 100000 },
      { type: "asset.cash", balance: 5000 },
      { type: "liability.credit_card", balance: 3000 },
      { type: "liability.loan", balance: 20000 },
    ];
    expect(computeNetWorth(accounts)).toBe(132000);
  });
});
