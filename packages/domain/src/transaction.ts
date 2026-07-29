export type TransactionType = "income" | "expense" | "transfer" | "obligation";
export type TransactionDirection = "in" | "out" | "internal";

export type TransactionCategory =
  | "Income"
  | "Groceries"
  | "Subscriptions"
  | "Transport"
  | "Health"
  | "Shopping"
  | "Housing"
  | "Transfer"
  | "Other";

export interface TransactionTypeMeta {
  label: string;
  direction: TransactionDirection;
  affectsNetWorth: boolean;
}

export interface TransactionMetadata {
  merchant?: string;
  category?: TransactionCategory | string;
  notes?: string;
}

/** Shape aligned with Convex `transactions` (IDs as strings for domain/UI use). */
export interface Transaction extends TransactionMetadata {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  type: TransactionType;
  amount: number;
  description?: string;
  narration?: string;
  externalKey?: string;
  source?: string;
  statementId?: string;
}

export const TRANSACTION_TYPE_REGISTRY: Record<TransactionType, TransactionTypeMeta> =
  {
    income: { label: "Income", direction: "in", affectsNetWorth: true },
    expense: { label: "Expense", direction: "out", affectsNetWorth: true },
    transfer: {
      label: "Transfer",
      direction: "internal",
      affectsNetWorth: false,
    },
    obligation: { label: "Obligation", direction: "out", affectsNetWorth: true },
  };

export const TRANSACTION_CATEGORIES: readonly TransactionCategory[] = [
  "Income",
  "Groceries",
  "Subscriptions",
  "Transport",
  "Health",
  "Shopping",
  "Housing",
  "Transfer",
  "Other",
] as const;

export function requiresDestinationAccount(type: TransactionType): boolean {
  return type === "transfer";
}

export function isTransactionCategory(
  value: string,
): value is TransactionCategory {
  return (TRANSACTION_CATEGORIES as readonly string[]).includes(value);
}
