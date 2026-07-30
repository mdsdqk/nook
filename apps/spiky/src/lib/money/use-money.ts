import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { AccountType, TransactionType } from "@nook/domain";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth";
import { filterTransactions } from "./filters";
import type {
  AccountInput,
  CashFlowPoint,
  MoneyAccount,
  MoneyTransaction,
  TransactionFilters,
  TransactionInput,
} from "./types";

const defaultFilters: TransactionFilters = {
  type: "all",
  accountId: null,
  cardAccountId: null,
  search: "",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapAccount(doc: {
  _id: Id<"accounts">;
  userId: Id<"users">;
  name: string;
  type: string;
  institution?: string;
  accountFingerprint?: string;
  accountNumberMasked?: string;
  currency: string;
  balance: number;
}): MoneyAccount {
  const account: MoneyAccount = {
    id: doc._id,
    userId: doc.userId,
    name: doc.name,
    type: doc.type as AccountType,
    currency: doc.currency,
    balance: doc.balance,
  };
  if (doc.institution !== undefined) account.institution = doc.institution;
  if (doc.accountFingerprint !== undefined) {
    account.accountFingerprint = doc.accountFingerprint;
  }
  if (doc.accountNumberMasked !== undefined) {
    account.accountNumberMasked = doc.accountNumberMasked;
  }
  return account;
}

function mapTransaction(doc: {
  _id: Id<"transactions">;
  userId: Id<"users">;
  accountId: Id<"accounts">;
  date: string;
  type: string;
  amount: number;
  description?: string;
  narration?: string;
  merchant?: string;
  category?: string;
  notes?: string;
  externalKey?: string;
  source?: string;
  statementId?: Id<"parsedStatements">;
}): MoneyTransaction {
  const txn: MoneyTransaction = {
    id: doc._id,
    userId: doc.userId,
    accountId: doc.accountId,
    date: doc.date,
    type: doc.type as TransactionType,
    amount: doc.amount,
  };
  if (doc.description !== undefined) txn.description = doc.description;
  if (doc.narration !== undefined) txn.narration = doc.narration;
  if (doc.merchant !== undefined) txn.merchant = doc.merchant;
  if (doc.category !== undefined) txn.category = doc.category;
  if (doc.notes !== undefined) txn.notes = doc.notes;
  if (doc.externalKey !== undefined) txn.externalKey = doc.externalKey;
  if (doc.source !== undefined) txn.source = doc.source;
  if (doc.statementId !== undefined) txn.statementId = doc.statementId;
  return txn;
}

export type UnsyncedStatement = {
  id: string;
  bank: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  accountNumberMasked: string;
};

export function useMoney(filters: TransactionFilters = defaultFilters) {
  const { session } = useAuth();
  const userId = session?.userId;
  const asOfDate = todayIso();

  const accountsQuery = useQuery(
    api.accounts.list,
    userId ? { userId, asOfDate } : "skip",
  );
  const transactionsQuery = useQuery(
    api.transactions.list,
    userId ? { userId } : "skip",
  );
  const cashFlowQuery = useQuery(
    api.dashboard.cashflowTimeline,
    userId ? { userId, granularity: "monthly" } : "skip",
  );
  const unsyncedQuery = useQuery(
    api.ledgerSync.listUnsynced,
    userId ? { userId } : "skip",
  );

  const createAccountMut = useMutation(api.accounts.create);
  const updateAccountMut = useMutation(api.accounts.update);
  const removeAccountMut = useMutation(api.accounts.remove);
  const normalizeBankTypesMut = useMutation(
    api.accounts.normalizeLegacyBankTypes,
  );
  const createTxnMut = useMutation(api.transactions.create);
  const updateTxnMut = useMutation(api.transactions.update);
  const removeTxnMut = useMutation(api.transactions.remove);
  const syncPendingMut = useMutation(api.ledgerSync.syncPendingForUser);

  const [syncPending, setSyncPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const normalizedLegacyRef = useRef(false);

  useEffect(() => {
    if (!userId || !accountsQuery || normalizedLegacyRef.current) return;
    const hasLegacy = accountsQuery.some(
      (account) => account.type === "asset.bank",
    );
    if (!hasLegacy) {
      normalizedLegacyRef.current = true;
      return;
    }
    normalizedLegacyRef.current = true;
    void normalizeBankTypesMut({ userId });
  }, [userId, accountsQuery, normalizeBankTypesMut]);

  const isLoading =
    userId !== undefined &&
    (accountsQuery === undefined ||
      transactionsQuery === undefined ||
      cashFlowQuery === undefined ||
      unsyncedQuery === undefined);

  const accounts = useMemo(
    () => (accountsQuery ?? []).map(mapAccount),
    [accountsQuery],
  );

  const transactions = useMemo(
    () => (transactionsQuery ?? []).map(mapTransaction),
    [transactionsQuery],
  );

  const cashFlow: CashFlowPoint[] = useMemo(
    () =>
      (cashFlowQuery ?? []).map((point) => ({
        month: point.month,
        net: point.net,
      })),
    [cashFlowQuery],
  );

  const unsyncedStatements: UnsyncedStatement[] = useMemo(
    () =>
      (unsyncedQuery ?? []).map((row) => ({
        id: row._id,
        bank: row.bank,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        transactionCount: row.transactionCount,
        accountNumberMasked: row.accountNumberMasked,
      })),
    [unsyncedQuery],
  );

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, accounts, filters),
    [transactions, accounts, filters],
  );

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts],
  );

  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === "liability.credit_card"),
    [accounts],
  );

  const isEmpty = !isLoading && accounts.length === 0;
  const hasUnsynced = unsyncedStatements.length > 0;

  const createAccount = useCallback(
    async (input: AccountInput) => {
      if (!userId) throw new Error("Not authenticated");
      await createAccountMut({
        userId,
        name: input.name,
        type: input.type,
        currency: input.currency,
        asOfDate,
        balance: input.balance,
        ...(input.institution !== undefined
          ? { institution: input.institution }
          : {}),
        ...(input.accountNumberMasked !== undefined
          ? { accountNumberMasked: input.accountNumberMasked }
          : {}),
      });
    },
    [userId, createAccountMut, asOfDate],
  );

  const updateAccount = useCallback(
    async (id: string, input: AccountInput) => {
      if (!userId) throw new Error("Not authenticated");
      await updateAccountMut({
        userId,
        accountId: id as Id<"accounts">,
        name: input.name,
        type: input.type,
        currency: input.currency,
        asOfDate,
        balance: input.balance,
        ...(input.institution !== undefined
          ? { institution: input.institution }
          : {}),
        ...(input.accountNumberMasked !== undefined
          ? { accountNumberMasked: input.accountNumberMasked }
          : {}),
      });
    },
    [userId, updateAccountMut, asOfDate],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Not authenticated");
      await removeAccountMut({
        userId,
        accountId: id as Id<"accounts">,
      });
    },
    [userId, removeAccountMut],
  );

  const createTransaction = useCallback(
    async (input: TransactionInput) => {
      if (!userId) throw new Error("Not authenticated");
      await createTxnMut({
        userId,
        accountId: input.accountId as Id<"accounts">,
        date: input.date,
        type: input.type,
        amount: input.amount,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.narration !== undefined
          ? { narration: input.narration }
          : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(input.category !== undefined
          ? { category: String(input.category) }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
    },
    [userId, createTxnMut],
  );

  const updateTransaction = useCallback(
    async (id: string, input: TransactionInput) => {
      if (!userId) throw new Error("Not authenticated");
      await updateTxnMut({
        userId,
        transactionId: id as Id<"transactions">,
        accountId: input.accountId as Id<"accounts">,
        date: input.date,
        type: input.type,
        amount: input.amount,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.narration !== undefined
          ? { narration: input.narration }
          : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(input.category !== undefined
          ? { category: String(input.category) }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
    },
    [userId, updateTxnMut],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Not authenticated");
      await removeTxnMut({
        userId,
        transactionId: id as Id<"transactions">,
      });
    },
    [userId, removeTxnMut],
  );

  const syncPendingStatements = useCallback(async () => {
    if (!userId) throw new Error("Not authenticated");
    setSyncPending(true);
    setSyncError(null);
    try {
      await syncPendingMut({ userId });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
      throw err;
    } finally {
      setSyncPending(false);
    }
  }, [userId, syncPendingMut]);

  return {
    accounts,
    transactions,
    filteredTransactions,
    cashFlow,
    totalBalance,
    creditCards,
    isLoading,
    isEmpty,
    hasUnsynced,
    unsyncedStatements,
    syncPending,
    syncError,
    createAccount,
    updateAccount,
    deleteAccount,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    syncPendingStatements,
  };
}
