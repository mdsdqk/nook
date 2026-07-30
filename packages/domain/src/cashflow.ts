import type { TransactionType } from "./transaction";
import { TRANSACTION_TYPE_REGISTRY } from "./transaction";

export type DashboardClassification =
  | "spending"
  | "cashflow_in"
  | "cashflow_out"
  | "neutral";

const CASHFLOW_IN_TYPES = new Set<TransactionType>([
  "salary",
  "interest",
  "dividend",
  "rental_income",
  "business_income",
  "capital_gain",
  "gift",
  "cashback",
  "tax_refund",
  "unclassified_income",
  "loan_disbursement",
  "investment_redemption",
  "insurance_claim",
  "friend_repayment",
  "shared_expense_repayment",
]);

export function isSpending(type: TransactionType): boolean {
  return TRANSACTION_TYPE_REGISTRY[type].isLifestyleSpending;
}

export function isCashflowIn(type: TransactionType): boolean {
  return CASHFLOW_IN_TYPES.has(type);
}

export function isCashflowOut(type: TransactionType): boolean {
  if (isCashflowIn(type)) return false;
  const group = TRANSACTION_TYPE_REGISTRY[type].group;
  return (
    group === "expense" ||
    group === "debt" ||
    group === "tax" ||
    group === "fees" ||
    group === "insurance" ||
    group === "transfer" ||
    group === "investment"
  );
}

export function classifyForDashboard(
  type: TransactionType,
): DashboardClassification {
  if (isSpending(type)) return "spending";
  if (isCashflowIn(type)) return "cashflow_in";
  if (isCashflowOut(type)) return "cashflow_out";
  return "neutral";
}
