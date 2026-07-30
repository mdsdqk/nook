export type AccountType =
  | "asset"
  | "asset.cash"
  | "asset.bank"
  | "asset.bank.savings"
  | "asset.bank.current"
  | "asset.wallet"
  | "asset.investment"
  | "liability"
  | "liability.credit_card"
  | "liability.loan";

export interface AccountTypeMeta {
  label: string;
  parent: AccountType | null;
  isAsset: boolean;
  isLiability: boolean;
}

export const ACCOUNT_TYPE_REGISTRY: Record<AccountType, AccountTypeMeta> = {
  asset: { label: "Asset", parent: null, isAsset: true, isLiability: false },
  "asset.cash": {
    label: "Cash",
    parent: "asset",
    isAsset: true,
    isLiability: false,
  },
  "asset.bank": {
    label: "Bank",
    parent: "asset",
    isAsset: true,
    isLiability: false,
  },
  "asset.bank.savings": {
    label: "Savings",
    parent: "asset.bank",
    isAsset: true,
    isLiability: false,
  },
  "asset.bank.current": {
    label: "Current",
    parent: "asset.bank",
    isAsset: true,
    isLiability: false,
  },
  "asset.wallet": {
    label: "Wallet",
    parent: "asset",
    isAsset: true,
    isLiability: false,
  },
  "asset.investment": {
    label: "Investment",
    parent: "asset",
    isAsset: true,
    isLiability: false,
  },
  liability: {
    label: "Liability",
    parent: null,
    isAsset: false,
    isLiability: true,
  },
  "liability.credit_card": {
    label: "Credit Card",
    parent: "liability",
    isAsset: false,
    isLiability: true,
  },
  "liability.loan": {
    label: "Loan",
    parent: "liability",
    isAsset: false,
    isLiability: true,
  },
};

export function isAssetType(type: AccountType): boolean {
  return ACCOUNT_TYPE_REGISTRY[type].isAsset;
}

export function isLiabilityType(type: AccountType): boolean {
  return ACCOUNT_TYPE_REGISTRY[type].isLiability;
}

export function getSubtypes(parent: AccountType): AccountType[] {
  return (Object.keys(ACCOUNT_TYPE_REGISTRY) as AccountType[]).filter(
    (type) => ACCOUNT_TYPE_REGISTRY[type].parent === parent,
  );
}

export function getParentType(type: AccountType): AccountType | null {
  return ACCOUNT_TYPE_REGISTRY[type].parent;
}

export function isLeafAccountType(type: AccountType): boolean {
  return getSubtypes(type).length === 0;
}

/** Leaf account types suitable for create/edit forms (excludes category parents). */
export function getSelectableAccountTypes(): AccountType[] {
  return (Object.keys(ACCOUNT_TYPE_REGISTRY) as AccountType[]).filter(
    (type) =>
      ACCOUNT_TYPE_REGISTRY[type].parent !== null && isLeafAccountType(type),
  );
}

export function isBankAccountType(type: AccountType | string): boolean {
  return type === "asset.bank" || type.startsWith("asset.bank.");
}

export function getAccountTypeLabel(type: string): string {
  if (type in ACCOUNT_TYPE_REGISTRY) {
    return ACCOUNT_TYPE_REGISTRY[type as AccountType].label;
  }
  return type.split(".").pop() ?? type;
}
