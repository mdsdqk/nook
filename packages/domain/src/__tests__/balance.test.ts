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
  it("income increases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 1000,
      date: "2026-03-01",
      type: "income",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(1000);
  });

  it("income has no effect on unrelated account", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 1000,
      date: "2026-03-01",
      type: "income",
    };
    expect(computeTransactionEffect(tx, UNRELATED)).toBe(0);
  });

  it("expense decreases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 500,
      date: "2026-03-01",
      type: "expense",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(-500);
  });

  it("obligation decreases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      amount: 2000,
      date: "2026-03-01",
      type: "obligation",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(-2000);
  });

  it("transfer decreases source account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: 300,
      date: "2026-03-01",
      type: "transfer",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_A)).toBe(-300);
  });

  it("transfer increases destination account balance", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: 300,
      date: "2026-03-01",
      type: "transfer",
    };
    expect(computeTransactionEffect(tx, ACCOUNT_B)).toBe(300);
  });

  it("transfer has no effect on unrelated account", () => {
    const tx: LedgerTransaction = {
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      amount: 300,
      date: "2026-03-01",
      type: "transfer",
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
        type: "expense",
      },
      {
        accountId: ACCOUNT_A,
        amount: 1000,
        date: "2026-03-10",
        type: "income",
      },
    ];
    // 5000 - 200 + 1000 = 5800
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
        type: "income",
      },
      {
        accountId: ACCOUNT_A,
        amount: 100,
        date: "2026-03-05",
        type: "expense",
      },
    ];
    // Snaps to assertion at 2026-03-01 (balance 8000).
    // Only txns after 2026-03-01 count: -100
    // Result: 8000 - 100 = 7900
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
        type: "expense",
      },
    ];
    // Query at 2026-02-15: snaps to assertion at 2026-01-01 (1000),
    // applies txn on 2026-02-15: -200 => 800
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-02-15"),
    ).toBe(800);

    // Query at 2026-03-15: snaps to assertion at 2026-03-01 (5000),
    // no txns after 2026-03-01 => 5000
    // The backdated txn does NOT affect the post-assertion balance
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-15"),
    ).toBe(5000);
  });

  it("handles gap with no transactions between assertions (snapping)", () => {
    const assertions: BalanceAssertion[] = [
      { accountId: ACCOUNT_A, date: "2026-01-01", balance: 1000 },
      { accountId: ACCOUNT_A, date: "2026-06-01", balance: 3000 },
    ];
    // Query in the gap — no txns, snaps to first assertion
    expect(
      computeAccountBalance(assertions, [], ACCOUNT_A, "2026-03-15"),
    ).toBe(1000);
    // Query after second assertion — snaps to second assertion
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
        type: "income",
      },
      {
        accountId: ACCOUNT_A,
        amount: 200,
        date: "2026-03-10",
        type: "expense",
      },
    ];
    // No assertion before 2026-03-15, baseline = 0
    // Txns in (-inf, 2026-03-15]: +1000 - 200 = 800
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
        type: "expense",
      },
    ];
    // Txn date is NOT strictly after assertion date, so it's excluded
    expect(
      computeAccountBalance(assertions, txns, ACCOUNT_A, "2026-03-01"),
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
        type: "income",
      },
      {
        accountId: ACCOUNT_A,
        amount: 2000,
        date: "2026-03-10",
        type: "expense",
      },
      {
        accountId: ACCOUNT_A,
        toAccountId: ACCOUNT_B,
        amount: 1000,
        date: "2026-03-12",
        type: "transfer",
      },
      {
        accountId: ACCOUNT_A,
        amount: 500,
        date: "2026-03-14",
        type: "obligation",
      },
    ];
    // 10000 + 5000 - 2000 - 1000 - 500 = 11500
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
    // (50000 + 100000 + 5000) - (3000 + 20000) = 132000
    expect(computeNetWorth(accounts)).toBe(132000);
  });
});
