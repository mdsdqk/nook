import type { BalanceAssertion } from "./assertion";
import type { AccountType } from "./account";
import { isAssetType } from "./account";
import type { TransactionDirection, TransactionType } from "./transaction";
import { isTransferType, signedAmount } from "./transaction";

export interface LedgerTransaction {
  accountId: string;
  toAccountId?: string;
  amount: number;
  date: string;
  direction: TransactionDirection;
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

  // Collapsed dual-account internal transfer: source debit, destination credit
  if (isTransferType(tx.type) && tx.toAccountId) {
    if (tx.accountId === accountId) return -tx.amount;
    if (tx.toAccountId === accountId) return tx.amount;
    return 0;
  }

  if (tx.accountId === accountId) {
    return signedAmount(tx.direction, tx.amount);
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
