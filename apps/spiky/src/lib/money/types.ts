import type { AccountType } from "@nook/domain";
import type { TransactionType, TransactionCategory } from "@nook/domain";

/** Mirrors Convex `accounts` + latest balance for UI. */
export interface MoneyAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institution?: string;
  accountFingerprint?: string;
  accountNumberMasked?: string;
  currency: string;
  balance: number;
}

/** Mirrors Convex `transactions` including metadata fields. */
export interface MoneyTransaction {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  type: TransactionType;
  amount: number;
  description?: string;
  narration?: string;
  merchant?: string;
  category?: TransactionCategory | string;
  notes?: string;
  externalKey?: string;
  source?: string;
  statementId?: string;
}

export interface CashFlowPoint {
  month: string;
  net: number;
}

export type TransactionTypeFilter = "all" | "income" | "expense" | "transfer";

export interface TransactionFilters {
  type: TransactionTypeFilter;
  accountId: string | null;
  cardAccountId: string | null;
  search: string;
}

export type AccountInput = Omit<MoneyAccount, "id" | "userId">;
export type AccountUpdate = Partial<AccountInput>;

export type TransactionInput = Omit<MoneyTransaction, "id" | "userId">;
export type TransactionUpdate = Partial<TransactionInput>;
