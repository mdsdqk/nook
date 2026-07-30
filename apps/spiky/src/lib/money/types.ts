import type { AccountType } from "@nook/domain";
import type {
  TransactionDirection,
  TransactionType,
  TransactionTypeGroup,
} from "@nook/domain";

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

export type TransferRole = "out" | "in";

/** Mirrors Convex `transactions` including metadata fields. */
export interface MoneyTransaction {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  direction: TransactionDirection;
  type: TransactionType;
  amount: number;
  description?: string;
  narration?: string;
  merchant?: string;
  category?: string;
  notes?: string;
  externalKey?: string;
  source?: string;
  statementId?: string;
  linkedTransactionId?: string;
  transferRole?: TransferRole;
}

/** A newly synced transfer pair returned for review. */
export interface SyncedTransferPair {
  outId: string;
  inId: string;
  amount: number;
  outAccountId: string;
  inAccountId: string;
  outDate: string;
  inDate: string;
  outDescription?: string;
  inDescription?: string;
}

export interface CashFlowPoint {
  month: string;
  net: number;
}

/** Filter by type group (or all). */
export type TransactionTypeFilter = "all" | TransactionTypeGroup;

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
