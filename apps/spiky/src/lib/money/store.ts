import { signedAmount } from "@nook/domain";
import {
  MOCK_USER_ID,
  SEED_ACCOUNTS,
  SEED_CASH_FLOW,
  SEED_TRANSACTIONS,
} from "./mock-data";
import type {
  AccountInput,
  AccountUpdate,
  CashFlowPoint,
  MoneyAccount,
  MoneyTransaction,
  TransactionInput,
  TransactionUpdate,
} from "./types";

export type MoneySnapshot = {
  accounts: MoneyAccount[];
  transactions: MoneyTransaction[];
  cashFlow: CashFlowPoint[];
};

type Listener = () => void;

function cloneAccounts(accounts: MoneyAccount[]): MoneyAccount[] {
  return accounts.map((a) => ({ ...a }));
}

function cloneTransactions(txns: MoneyTransaction[]): MoneyTransaction[] {
  return txns.map((t) => ({ ...t }));
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function balanceDelta(
  direction: MoneyTransaction["direction"],
  amount: number,
): number {
  return signedAmount(direction, Math.abs(amount));
}

class MoneyStoreImpl {
  private accounts = cloneAccounts(SEED_ACCOUNTS);
  private transactions = cloneTransactions(SEED_TRANSACTIONS);
  private cashFlow = SEED_CASH_FLOW.map((p) => ({ ...p }));
  private listeners = new Set<Listener>();
  /** Stable reference for useSyncExternalStore - only replaced on mutation. */
  private snapshot: MoneySnapshot = {
    accounts: this.accounts,
    transactions: this.transactions,
    cashFlow: this.cashFlow,
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): MoneySnapshot => this.snapshot;

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private replaceSnapshot(next: {
    accounts?: MoneyAccount[];
    transactions?: MoneyTransaction[];
    cashFlow?: CashFlowPoint[];
  }) {
    if (next.accounts) this.accounts = next.accounts;
    if (next.transactions) this.transactions = next.transactions;
    if (next.cashFlow) this.cashFlow = next.cashFlow;
    this.snapshot = {
      accounts: this.accounts,
      transactions: this.transactions,
      cashFlow: this.cashFlow,
    };
    this.emit();
  }

  totalBalance(): number {
    return this.accounts.reduce((sum, a) => sum + a.balance, 0);
  }

  createAccount(input: AccountInput): MoneyAccount {
    const account: MoneyAccount = {
      ...input,
      id: createId("acct"),
      userId: MOCK_USER_ID,
    };
    this.replaceSnapshot({ accounts: [...this.accounts, account] });
    return account;
  }

  updateAccount(id: string, patch: AccountUpdate): MoneyAccount {
    const index = this.accounts.findIndex((a) => a.id === id);
    if (index < 0) throw new Error("Account not found");
    const updated = { ...this.accounts[index]!, ...patch };
    const accounts = [...this.accounts];
    accounts[index] = updated;
    this.replaceSnapshot({ accounts });
    return updated;
  }

  deleteAccount(id: string): void {
    const hasTxns = this.transactions.some((t) => t.accountId === id);
    if (hasTxns) {
      throw new Error(
        "Cannot delete account with existing transactions. Remove those transactions first.",
      );
    }
    this.replaceSnapshot({
      accounts: this.accounts.filter((a) => a.id !== id),
    });
  }

  createTransaction(input: TransactionInput): MoneyTransaction {
    const account = this.accounts.find((a) => a.id === input.accountId);
    if (!account) throw new Error("Account not found");

    const txn: MoneyTransaction = {
      ...input,
      id: createId("txn"),
      userId: MOCK_USER_ID,
    };

    const delta = balanceDelta(input.direction, input.amount);
    const accounts = this.accounts.map((a) =>
      a.id === input.accountId ? { ...a, balance: a.balance + delta } : a,
    );

    this.replaceSnapshot({
      accounts,
      transactions: [txn, ...this.transactions],
    });
    return txn;
  }

  updateTransaction(id: string, patch: TransactionUpdate): MoneyTransaction {
    const index = this.transactions.findIndex((t) => t.id === id);
    if (index < 0) throw new Error("Transaction not found");

    const previous = this.transactions[index]!;
    const next: MoneyTransaction = { ...previous, ...patch };

    let accounts = cloneAccounts(this.accounts);

    const prevDelta = balanceDelta(previous.direction, previous.amount);
    accounts = accounts.map((a) =>
      a.id === previous.accountId
        ? { ...a, balance: a.balance - prevDelta }
        : a,
    );

    const account = accounts.find((a) => a.id === next.accountId);
    if (!account) throw new Error("Account not found");
    const nextDelta = balanceDelta(next.direction, next.amount);
    accounts = accounts.map((a) =>
      a.id === next.accountId ? { ...a, balance: a.balance + nextDelta } : a,
    );

    const transactions = [...this.transactions];
    transactions[index] = next;
    this.replaceSnapshot({ accounts, transactions });
    return next;
  }

  deleteTransaction(id: string): void {
    const txn = this.transactions.find((t) => t.id === id);
    if (!txn) throw new Error("Transaction not found");

    const delta = balanceDelta(txn.direction, txn.amount);
    const accounts = this.accounts.map((a) =>
      a.id === txn.accountId ? { ...a, balance: a.balance - delta } : a,
    );

    this.replaceSnapshot({
      accounts,
      transactions: this.transactions.filter((t) => t.id !== id),
    });
  }

  /** Test helper: reset to seed data. */
  reset(): void {
    this.replaceSnapshot({
      accounts: cloneAccounts(SEED_ACCOUNTS),
      transactions: cloneTransactions(SEED_TRANSACTIONS),
      cashFlow: SEED_CASH_FLOW.map((p) => ({ ...p })),
    });
  }
}

export const moneyStore = new MoneyStoreImpl();
