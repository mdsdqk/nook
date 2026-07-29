import { useMemo, useSyncExternalStore } from "react";
import { filterTransactions } from "./filters";
import { moneyStore } from "./store";
import type { TransactionFilters } from "./types";

const defaultFilters: TransactionFilters = {
  type: "all",
  accountId: null,
  cardAccountId: null,
  search: "",
};

export function useMoney(filters: TransactionFilters = defaultFilters) {
  const snapshot = useSyncExternalStore(
    moneyStore.subscribe,
    moneyStore.getSnapshot,
    moneyStore.getSnapshot,
  );

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(snapshot.transactions, snapshot.accounts, filters),
    [snapshot.transactions, snapshot.accounts, filters],
  );

  const totalBalance = useMemo(
    () => snapshot.accounts.reduce((sum, a) => sum + a.balance, 0),
    [snapshot.accounts],
  );

  const creditCards = useMemo(
    () =>
      snapshot.accounts.filter((a) => a.type === "liability.credit_card"),
    [snapshot.accounts],
  );

  return {
    accounts: snapshot.accounts,
    transactions: snapshot.transactions,
    filteredTransactions,
    cashFlow: snapshot.cashFlow,
    totalBalance,
    creditCards,
    createAccount: moneyStore.createAccount.bind(moneyStore),
    updateAccount: moneyStore.updateAccount.bind(moneyStore),
    deleteAccount: moneyStore.deleteAccount.bind(moneyStore),
    createTransaction: moneyStore.createTransaction.bind(moneyStore),
    updateTransaction: moneyStore.updateTransaction.bind(moneyStore),
    deleteTransaction: moneyStore.deleteTransaction.bind(moneyStore),
  };
}
