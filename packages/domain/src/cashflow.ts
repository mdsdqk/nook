import type { TransactionType } from "./transaction";

export type DashboardClassification =
  | "spending"
  | "cashflow_in"
  | "cashflow_out"
  | "neutral";

export function isSpending(type: TransactionType): boolean {
  return type === "expense";
}

export function isCashflowOut(type: TransactionType): boolean {
  return type === "expense" || type === "obligation" || type === "transfer";
}

export function isCashflowIn(type: TransactionType): boolean {
  return type === "income";
}

export function classifyForDashboard(
  type: TransactionType,
): DashboardClassification {
  if (isSpending(type)) return "spending";
  if (isCashflowIn(type)) return "cashflow_in";
  if (isCashflowOut(type)) return "cashflow_out";
  return "neutral";
}
