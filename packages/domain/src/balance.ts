import type { BalanceAssertion } from "./assertion";
import type { AccountType } from "./account";
import { isAssetType } from "./account";
import type { TransactionType } from "./transaction";

export interface LedgerTransaction {
  accountId: string;
  toAccountId?: string;
  amount: number;
  date: string;
  type: TransactionType;
}

export interface NetWorthAccount {
  type: AccountType;
  balance: number;
}

export function computeTransactionEffect(
  tx: LedgerTransaction,
  accountId: string,
): number {
  if (tx.accountId !== accountId && tx.toAccountId !== accountId) {
    return 0;
  }

  if (tx.type === "income") return tx.accountId === accountId ? tx.amount : 0;
  if (tx.type === "expense" || tx.type === "obligation") {
    return tx.accountId === accountId ? -tx.amount : 0;
  }
  if (tx.type === "transfer") {
    if (tx.accountId === accountId) return -tx.amount;
    if (tx.toAccountId === accountId) return tx.amount;
  }
  return 0;
}

export function computeAccountBalance(
  assertions: BalanceAssertion[],
  txns: LedgerTransaction[],
  accountId: string,
  asOfDate: string,
): number {
  const dateMs = Date.parse(asOfDate);
  const applicableAssertions = assertions
    .filter((a) => a.accountId === accountId && Date.parse(a.date) <= dateMs)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const baseline = applicableAssertions[applicableAssertions.length - 1];
  const baselineDateMs = baseline ? Date.parse(baseline.date) : Number.NEGATIVE_INFINITY;
  const baselineBalance = baseline ? baseline.balance : 0;

  const delta = txns
    .filter((tx) => {
      const txDate = Date.parse(tx.date);
      return txDate > baselineDateMs && txDate <= dateMs;
    })
    .reduce((sum, tx) => sum + computeTransactionEffect(tx, accountId), 0);

  return baselineBalance + delta;
}

export function computeNetWorth(accounts: NetWorthAccount[]): number {
  return accounts.reduce((sum, account) => {
    return sum + (isAssetType(account.type) ? account.balance : -account.balance);
  }, 0);
}
