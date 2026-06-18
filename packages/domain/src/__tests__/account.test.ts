import { describe, it, expect } from "vitest";
import {
  type AccountType,
  ACCOUNT_TYPE_REGISTRY,
  isAssetType,
  isLiabilityType,
  getSubtypes,
  getParentType,
} from "../account";

const ALL_TYPES = Object.keys(ACCOUNT_TYPE_REGISTRY) as AccountType[];

describe("ACCOUNT_TYPE_REGISTRY", () => {
  it("has an entry for every AccountType union member", () => {
    const expected: AccountType[] = [
      "asset",
      "asset.cash",
      "asset.bank",
      "asset.wallet",
      "asset.investment",
      "liability",
      "liability.credit_card",
      "liability.loan",
    ];
    expect(ALL_TYPES.sort()).toEqual(expected.sort());
  });

  it("every entry has required metadata fields", () => {
    for (const type of ALL_TYPES) {
      const meta = ACCOUNT_TYPE_REGISTRY[type];
      expect(meta).toHaveProperty("label");
      expect(meta).toHaveProperty("parent");
      expect(meta).toHaveProperty("isAsset");
      expect(meta).toHaveProperty("isLiability");
      expect(typeof meta.label).toBe("string");
      expect(typeof meta.isAsset).toBe("boolean");
      expect(typeof meta.isLiability).toBe("boolean");
    }
  });

  it("no type is both asset and liability", () => {
    for (const type of ALL_TYPES) {
      const meta = ACCOUNT_TYPE_REGISTRY[type];
      expect(meta.isAsset && meta.isLiability).toBe(false);
    }
  });

  it("every type is either asset or liability", () => {
    for (const type of ALL_TYPES) {
      const meta = ACCOUNT_TYPE_REGISTRY[type];
      expect(meta.isAsset || meta.isLiability).toBe(true);
    }
  });
});

describe("isAssetType", () => {
  it("returns true for all asset types", () => {
    const assetTypes: AccountType[] = [
      "asset",
      "asset.cash",
      "asset.bank",
      "asset.wallet",
      "asset.investment",
    ];
    for (const type of assetTypes) {
      expect(isAssetType(type)).toBe(true);
    }
  });

  it("returns false for all liability types", () => {
    const liabilityTypes: AccountType[] = [
      "liability",
      "liability.credit_card",
      "liability.loan",
    ];
    for (const type of liabilityTypes) {
      expect(isAssetType(type)).toBe(false);
    }
  });
});

describe("isLiabilityType", () => {
  it("returns true for all liability types", () => {
    const liabilityTypes: AccountType[] = [
      "liability",
      "liability.credit_card",
      "liability.loan",
    ];
    for (const type of liabilityTypes) {
      expect(isLiabilityType(type)).toBe(true);
    }
  });

  it("returns false for all asset types", () => {
    const assetTypes: AccountType[] = [
      "asset",
      "asset.cash",
      "asset.bank",
      "asset.wallet",
      "asset.investment",
    ];
    for (const type of assetTypes) {
      expect(isLiabilityType(type)).toBe(false);
    }
  });
});

describe("getSubtypes", () => {
  it("returns all asset subtypes for 'asset'", () => {
    const subtypes = getSubtypes("asset");
    expect(subtypes.sort()).toEqual(
      ["asset.cash", "asset.bank", "asset.wallet", "asset.investment"].sort(),
    );
  });

  it("returns all liability subtypes for 'liability'", () => {
    const subtypes = getSubtypes("liability");
    expect(subtypes.sort()).toEqual(
      ["liability.credit_card", "liability.loan"].sort(),
    );
  });

  it("returns empty array for leaf types", () => {
    expect(getSubtypes("asset.cash")).toEqual([]);
    expect(getSubtypes("liability.loan")).toEqual([]);
  });
});

describe("getParentType", () => {
  it("returns parent for subtypes", () => {
    expect(getParentType("asset.cash")).toBe("asset");
    expect(getParentType("asset.bank")).toBe("asset");
    expect(getParentType("asset.wallet")).toBe("asset");
    expect(getParentType("asset.investment")).toBe("asset");
    expect(getParentType("liability.credit_card")).toBe("liability");
    expect(getParentType("liability.loan")).toBe("liability");
  });

  it("returns null for root types", () => {
    expect(getParentType("asset")).toBeNull();
    expect(getParentType("liability")).toBeNull();
  });
});
