export type AccountType =
  | "asset"
  | "asset.cash"
  | "asset.bank"
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
