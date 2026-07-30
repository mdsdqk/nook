import type { MoneyAccount, MoneyTransaction, TransactionFilters } from "./types";

function includesQuery(value: string | undefined, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query);
}

export function filterTransactions(
  transactions: MoneyTransaction[],
  _accounts: MoneyAccount[],
  filters: TransactionFilters,
): MoneyTransaction[] {
  const query = filters.search.trim().toLowerCase();

  return transactions.filter((txn) => {
    if (filters.type !== "all" && txn.type !== filters.type) {
      return false;
    }

    if (filters.accountId && txn.accountId !== filters.accountId) {
      return false;
    }

    if (filters.cardAccountId && txn.accountId !== filters.cardAccountId) {
      return false;
    }

    if (query) {
      const haystack = [
        txn.type,
        txn.description,
        txn.narration,
        txn.merchant,
        txn.category,
      ];
      if (!haystack.some((field) => includesQuery(field, query))) {
        return false;
      }
    }

    return true;
  });
}

export function creditCardAccounts(accounts: MoneyAccount[]): MoneyAccount[] {
  return accounts.filter((a) => a.type === "liability.credit_card");
}
