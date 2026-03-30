export type TransactionType = "income" | "expense" | "transfer" | "obligation";
export type TransactionDirection = "in" | "out" | "internal";

export interface TransactionTypeMeta {
  label: string;
  direction: TransactionDirection;
  affectsNetWorth: boolean;
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

export function requiresDestinationAccount(type: TransactionType): boolean {
  return type === "transfer";
}
