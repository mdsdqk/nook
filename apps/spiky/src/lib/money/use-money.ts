import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { AccountType, TransactionDirection, TransactionType } from "@nook/domain";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth";
import { filterTransactions } from "./filters";
import type {
  StatementImportResult,
  StatementSyncResult,
  ImportPolicy,
} from "./statement-import";
import { DEFAULT_IMPORT_POLICY } from "./statement-import";
import type {
  AccountInput,
  CashFlowPoint,
  MoneyAccount,
  MoneyTransaction,
  SyncedTransferPair,
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
  direction?: "credit" | "debit";
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
  linkedTransactionId?: Id<"transactions">;
  transferRole?: "out" | "in";
}): MoneyTransaction {
  const direction: TransactionDirection =
    doc.direction ??
    (doc.transferRole === "in"
      ? "credit"
      : doc.type === "unclassified_income" ||
          doc.type === "salary" ||
          doc.type === "income"
        ? "credit"
        : "debit");
  const txn: MoneyTransaction = {
    id: doc._id,
    userId: doc.userId,
    accountId: doc.accountId,
    date: doc.date,
    direction,
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
  if (doc.linkedTransactionId !== undefined) {
    txn.linkedTransactionId = doc.linkedTransactionId;
  }
  if (doc.transferRole !== undefined) txn.transferRole = doc.transferRole;
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
  const { isAuthenticated } = useAuth();
  const asOfDate = todayIso();

  const accountsQuery = useQuery(
    api.accounts.list,
    isAuthenticated ? { asOfDate } : "skip",
  );
  const transactionsQuery = useQuery(
    api.transactions.list,
    isAuthenticated ? {} : "skip",
  );
  const cashFlowQuery = useQuery(
    api.dashboard.cashflowTimeline,
    isAuthenticated ? { granularity: "monthly" } : "skip",
  );
  const unsyncedQuery = useQuery(
    api.ledgerSync.listUnsynced,
    isAuthenticated ? {} : "skip",
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
  const syncFromStatementIdMut = useMutation(
    api.ledgerSync.syncFromStatementId,
  );
  const generateUploadUrlMut = useMutation(
    api.statementUpload.generateUploadUrl,
  );
  const claimStatementUploadMut = useMutation(
    api.statementUpload.claimStatementUpload,
  );
  const importUploadedStatementAction = useAction(
    api.statementImportActions.importUploadedStatement,
  );
  const importPolicyQuery = useQuery(
    api.importLimitOverrides.getMyImportPolicy,
    isAuthenticated ? {} : "skip",
  );
  const syncTransfersMut = useMutation(api.transferSync.syncTransfers);
  const rejectTransferPairsMut = useMutation(
    api.transferSync.rejectTransferPairs,
  );

  const [syncPending, setSyncPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const normalizedLegacyRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accountsQuery || normalizedLegacyRef.current) return;
    const hasLegacy = accountsQuery.some(
      (account) => account.type === "asset.bank",
    );
    if (!hasLegacy) {
      normalizedLegacyRef.current = true;
      return;
    }
    normalizedLegacyRef.current = true;
    void normalizeBankTypesMut({});
  }, [isAuthenticated, accountsQuery, normalizeBankTypesMut]);

  const isLoading =
    isAuthenticated &&
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
      if (!isAuthenticated) throw new Error("Not authenticated");
      await createAccountMut({
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
    [isAuthenticated, createAccountMut, asOfDate],
  );

  const updateAccount = useCallback(
    async (id: string, input: AccountInput) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      await updateAccountMut({
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
    [isAuthenticated, updateAccountMut, asOfDate],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      await removeAccountMut({
        accountId: id as Id<"accounts">,
      });
    },
    [isAuthenticated, removeAccountMut],
  );

  const createTransaction = useCallback(
    async (input: TransactionInput) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      const category = input.category?.trim();
      await createTxnMut({
        accountId: input.accountId as Id<"accounts">,
        date: input.date,
        direction: input.direction,
        type: input.type,
        amount: input.amount,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.narration !== undefined
          ? { narration: input.narration }
          : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(category ? { category } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
    },
    [isAuthenticated, createTxnMut],
  );

  const updateTransaction = useCallback(
    async (id: string, input: TransactionInput) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      await updateTxnMut({
        transactionId: id as Id<"transactions">,
        accountId: input.accountId as Id<"accounts">,
        date: input.date,
        direction: input.direction,
        type: input.type,
        amount: input.amount,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.narration !== undefined
          ? { narration: input.narration }
          : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        // Empty string clears category server-side.
        category: input.category?.trim() ?? "",
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
    },
    [isAuthenticated, updateTxnMut],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      await removeTxnMut({
        transactionId: id as Id<"transactions">,
      });
    },
    [isAuthenticated, removeTxnMut],
  );

  const syncPendingStatements = useCallback(async () => {
    if (!isAuthenticated) throw new Error("Not authenticated");
    setSyncPending(true);
    setSyncError(null);
    try {
      await syncPendingMut({});
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
      throw err;
    } finally {
      setSyncPending(false);
    }
  }, [isAuthenticated, syncPendingMut]);

  const importStatementFile = useCallback(
    async (file: File): Promise<StatementImportResult> => {
      if (!isAuthenticated) throw new Error("Not authenticated");

      const uploadUrl = await generateUploadUrlMut({});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed (${uploadResponse.status})`);
      }
      const { storageId } = (await uploadResponse.json()) as {
        storageId: Id<"_storage">;
      };

      await claimStatementUploadMut({
        storageId,
        filename: file.name,
        byteSize: file.size,
      });

      const result = await importUploadedStatementAction({
        storageId,
      });

      const mapped: StatementImportResult = {
        ok: result.ok,
        accountExists: result.accountExists,
      };
      if (result.errors !== undefined) mapped.errors = result.errors;
      if (result.statementId !== undefined) {
        mapped.statementId = result.statementId;
      }
      if (
        result.action === "created" ||
        result.action === "replaced" ||
        result.action === "no-op"
      ) {
        mapped.action = result.action;
      }
      if (result.bank !== undefined) mapped.bank = result.bank;
      if (result.accountNumberMasked !== undefined) {
        mapped.accountNumberMasked = result.accountNumberMasked;
      }
      if (result.periodStart !== undefined) {
        mapped.periodStart = result.periodStart;
      }
      if (result.periodEnd !== undefined) mapped.periodEnd = result.periodEnd;
      if (result.transactionCount !== undefined) {
        mapped.transactionCount = result.transactionCount;
      }
      if (result.openingBalance !== undefined) {
        mapped.openingBalance = result.openingBalance;
      }
      if (result.closingBalance !== undefined) {
        mapped.closingBalance = result.closingBalance;
      }
      if (result.currency !== undefined) mapped.currency = result.currency;
      if (result.validationPassed !== undefined) {
        mapped.validationPassed = result.validationPassed;
      }
      if (result.filename !== undefined) mapped.filename = result.filename;
      return mapped;
    },
    [
      isAuthenticated,
      generateUploadUrlMut,
      claimStatementUploadMut,
      importUploadedStatementAction,
    ],
  );

  const syncStatementById = useCallback(
    async (statementId: string): Promise<StatementSyncResult> => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      const result = await syncFromStatementIdMut({
        statementId: statementId as Id<"parsedStatements">,
      });
      return {
        statementId,
        accountId: result.accountId,
        assertionsUpserted: result.assertionsUpserted,
        transactionsUpserted: result.transactionsUpserted,
        transactionsSkipped: result.transactionsSkipped,
        accountCreated: result.accountCreated,
      };
    },
    [isAuthenticated, syncFromStatementIdMut],
  );

  const syncTransfers = useCallback(async (): Promise<SyncedTransferPair[]> => {
    if (!isAuthenticated) throw new Error("Not authenticated");
    const result = await syncTransfersMut({});
    return result.pairs.map((pair) => {
      const mapped: SyncedTransferPair = {
        outId: pair.outId,
        inId: pair.inId,
        amount: pair.amount,
        outAccountId: pair.outAccountId,
        inAccountId: pair.inAccountId,
        outDate: pair.outDate,
        inDate: pair.inDate,
      };
      if (pair.outDescription !== undefined) {
        mapped.outDescription = pair.outDescription;
      }
      if (pair.inDescription !== undefined) {
        mapped.inDescription = pair.inDescription;
      }
      return mapped;
    });
  }, [isAuthenticated, syncTransfersMut]);

  const rejectTransferPairs = useCallback(
    async (outIds: string[]) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      if (outIds.length === 0) return;
      await rejectTransferPairsMut({
        outIds: outIds as Id<"transactions">[],
      });
    },
    [isAuthenticated, rejectTransferPairsMut],
  );

  const importPolicy: ImportPolicy = importPolicyQuery ?? {
    ...DEFAULT_IMPORT_POLICY,
  };

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
    importPolicy,
    createAccount,
    updateAccount,
    deleteAccount,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    syncPendingStatements,
    importStatementFile,
    syncStatementById,
    syncTransfers,
    rejectTransferPairs,
  };
}
