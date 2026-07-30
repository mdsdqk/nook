export type TransactionDirection = "credit" | "debit";

export type TransactionTypeGroup =
  | "income"
  | "expense"
  | "transfer"
  | "investment"
  | "debt"
  | "tax"
  | "insurance"
  | "fees";

export type TransactionType =
  // Income
  | "salary"
  | "interest"
  | "dividend"
  | "rental_income"
  | "business_income"
  | "capital_gain"
  | "gift"
  | "cashback"
  | "tax_refund"
  | "unclassified_income"
  // Expense
  | "expense"
  // Transfer
  | "internal_transfer"
  | "friend_loan"
  | "friend_repayment"
  | "shared_expense"
  | "shared_expense_repayment"
  // Investment
  | "investment_purchase"
  | "investment_redemption"
  // Debt
  | "loan_disbursement"
  | "loan_repayment"
  | "emi_payment"
  | "credit_card_payment"
  // Tax
  | "tax_payment"
  // Insurance
  | "insurance_premium"
  | "insurance_claim"
  // Fees
  | "bank_fee"
  | "brokerage"
  | "platform_fee";

export interface TransactionTypeMeta {
  label: string;
  group: TransactionTypeGroup;
  affectsNetWorth: boolean;
  isLifestyleSpending: boolean;
}

export interface TransactionMetadata {
  merchant?: string;
  /** Budgeting / reporting classification — free-form, not part of financial types. */
  category?: string;
  notes?: string;
}

/** Shape aligned with Convex `transactions` (IDs as strings for domain/UI use). */
export interface Transaction extends TransactionMetadata {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  direction: TransactionDirection;
  type: TransactionType;
  amount: number;
  description?: string;
  narration?: string;
  externalKey?: string;
  source?: string;
  statementId?: string;
}

function meta(
  label: string,
  group: TransactionTypeGroup,
  affectsNetWorth: boolean,
  isLifestyleSpending: boolean,
): TransactionTypeMeta {
  return { label, group, affectsNetWorth, isLifestyleSpending };
}

export const TRANSACTION_TYPE_REGISTRY: Record<
  TransactionType,
  TransactionTypeMeta
> = {
  salary: meta("Salary", "income", true, false),
  interest: meta("Interest", "income", true, false),
  dividend: meta("Dividend", "income", true, false),
  rental_income: meta("Rental Income", "income", true, false),
  business_income: meta("Business Income", "income", true, false),
  capital_gain: meta("Capital Gain", "income", true, false),
  gift: meta("Gift", "income", true, false),
  cashback: meta("Cashback", "income", true, false),
  tax_refund: meta("Tax Refund", "income", true, false),
  unclassified_income: meta("Unclassified Income", "income", true, false),

  expense: meta("Expense", "expense", true, true),

  internal_transfer: meta("Internal Transfer", "transfer", false, false),
  friend_loan: meta("Friend Loan", "transfer", false, false),
  friend_repayment: meta("Friend Repayment", "transfer", false, false),
  shared_expense: meta("Shared Expense", "transfer", false, false),
  shared_expense_repayment: meta(
    "Shared Expense Repayment",
    "transfer",
    false,
    false,
  ),

  investment_purchase: meta("Investment Purchase", "investment", false, false),
  investment_redemption: meta(
    "Investment Redemption",
    "investment",
    false,
    false,
  ),

  loan_disbursement: meta("Loan Disbursement", "debt", true, false),
  loan_repayment: meta("Loan Repayment", "debt", true, false),
  emi_payment: meta("EMI Payment", "debt", true, false),
  credit_card_payment: meta("Credit Card Payment", "debt", false, false),

  tax_payment: meta("Tax Payment", "tax", true, false),

  insurance_premium: meta("Insurance Premium", "insurance", true, false),
  insurance_claim: meta("Insurance Claim", "insurance", true, false),

  bank_fee: meta("Bank Fee", "fees", true, false),
  brokerage: meta("Brokerage", "fees", true, false),
  platform_fee: meta("Platform Fee", "fees", true, false),
};

/** UI hints for budgeting categories — not a closed domain union. */
export const SUGGESTED_CATEGORIES = [
  "Food",
  "Groceries",
  "Dining",
  "Fuel",
  "Shopping",
  "Healthcare",
  "Travel",
  "Entertainment",
  "Education",
  "Pets",
  "Subscriptions",
  "Electronics",
  "Housing",
  "Transport",
  "Other",
] as const;

/** @deprecated Use SUGGESTED_CATEGORIES */
export const TRANSACTION_CATEGORIES = SUGGESTED_CATEGORIES;

export type SuggestedCategory = (typeof SUGGESTED_CATEGORIES)[number];

/** @deprecated Prefer free-form category strings */
export type TransactionCategory = SuggestedCategory;

export const TRANSACTION_TYPES = Object.keys(
  TRANSACTION_TYPE_REGISTRY,
) as TransactionType[];

export function getTransactionTypeMeta(
  type: TransactionType,
): TransactionTypeMeta {
  return TRANSACTION_TYPE_REGISTRY[type];
}

export function isTransactionType(value: string): value is TransactionType {
  return value in TRANSACTION_TYPE_REGISTRY;
}

export function isIncomeType(type: TransactionType): boolean {
  return TRANSACTION_TYPE_REGISTRY[type].group === "income";
}

export function isTransferType(type: TransactionType): boolean {
  return TRANSACTION_TYPE_REGISTRY[type].group === "transfer";
}

export function isExpenseType(type: TransactionType): boolean {
  return TRANSACTION_TYPE_REGISTRY[type].group === "expense";
}

export function requiresDestinationAccount(type: TransactionType): boolean {
  return type === "internal_transfer";
}

export function isSuggestedCategory(value: string): boolean {
  return (SUGGESTED_CATEGORIES as readonly string[]).includes(value);
}

/** @deprecated Use isSuggestedCategory */
export function isTransactionCategory(value: string): boolean {
  return isSuggestedCategory(value);
}

export function signedAmount(
  direction: TransactionDirection,
  amount: number,
): number {
  return direction === "credit" ? amount : -amount;
}
