import { describe, it, expect } from "vitest";
import {
  ASSET_TRANSACTION_TYPES,
  ASSET_TRANSACTION_TYPE_REGISTRY,
  isAssetTransactionType,
  requiresQuantity,
  type AssetTransaction,
} from "../asset-transaction";
import { deriveHolding, type HoldingKey } from "../holding";
import {
  ASSET_CLASSES,
  isMutualFund,
  type MutualFundInstrument,
} from "../instrument";
import { computePortfolio } from "../portfolio";
import {
  compareWealthSourcePriority,
  WEALTH_SOURCE_TYPES,
} from "../wealth-source";

const KEY: HoldingKey = {
  ownerId: "user-1",
  instrumentId: "inst-ppfc",
  containerId: "folio-123",
};

const MF: MutualFundInstrument = {
  assetClass: "mutual_fund",
  id: "inst-ppfc",
  name: "Parag Parikh Flexi Cap Fund",
  currency: "INR",
  fundHouse: "PPFAS",
  schemeName: "Parag Parikh Flexi Cap Fund",
  plan: "direct",
  option: "growth",
  category: "Flexi Cap",
  provider: "PPFAS",
};

function txn(
  partial: Partial<AssetTransaction> &
    Pick<AssetTransaction, "id" | "type" | "date">,
): AssetTransaction {
  return {
    ownerId: KEY.ownerId,
    instrumentId: KEY.instrumentId,
    containerId: KEY.containerId,
    evidenceId: "ev-1",
    sourceType: "manual",
    ...partial,
  };
}

describe("instrument registry", () => {
  it("includes mutual_fund", () => {
    expect(ASSET_CLASSES).toContain("mutual_fund");
    expect(isMutualFund(MF)).toBe(true);
  });
});

describe("asset transaction registry", () => {
  it("covers economic event types only", () => {
    expect(ASSET_TRANSACTION_TYPES).toEqual([
      "purchase",
      "redemption",
      "dividend",
      "switch_in",
      "switch_out",
      "bonus",
    ]);
    expect(isAssetTransactionType("sip_purchase")).toBe(false);
    expect(ASSET_TRANSACTION_TYPE_REGISTRY.purchase.addsToCost).toBe(true);
  });
});

describe("wealth source priority", () => {
  it("ranks broker_api above manual", () => {
    expect(WEALTH_SOURCE_TYPES).toContain("manual");
    expect(compareWealthSourcePriority("broker_api", "manual")).toBeGreaterThan(
      0,
    );
    expect(compareWealthSourcePriority("cas", "manual")).toBeGreaterThan(0);
  });
});

describe("deriveHolding (average cost)", () => {
  it("replays purchases including SIP executionType", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          executionType: "lumpsum",
          date: "2026-01-01",
          quantity: 10,
          price: 100,
          amount: 1000,
        }),
        txn({
          id: "t2",
          type: "purchase",
          executionType: "sip",
          date: "2026-02-01",
          quantity: 5,
          price: 120,
          amount: 600,
        }),
      ],
      { strategy: "average" },
    );

    expect(holding.quantity).toBe(15);
    expect(holding.investedAmount).toBe(1600);
    expect(holding.costBasis).toBeCloseTo(1600 / 15);
    expect(holding.lastPrice).toBe(120);
    expect(holding.currentValue).toBeCloseTo(15 * 120);
    expect(holding.costBasisStrategy).toBe("average");
  });

  it("applies bonus without increasing cost", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          date: "2026-01-01",
          quantity: 10,
          price: 100,
          amount: 1000,
        }),
        txn({
          id: "t2",
          type: "bonus",
          date: "2026-03-01",
          quantity: 2,
          price: 110,
        }),
      ],
      { strategy: "average" },
    );

    expect(holding.quantity).toBe(12);
    expect(holding.investedAmount).toBe(1000);
    expect(holding.costBasis).toBeCloseTo(1000 / 12);
  });

  it("relieves average cost on redemption and tracks realized gain", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          date: "2026-01-01",
          quantity: 10,
          price: 100,
          amount: 1000,
        }),
        txn({
          id: "t2",
          type: "redemption",
          date: "2026-04-01",
          quantity: 4,
          price: 150,
          amount: 600,
        }),
      ],
      { strategy: "average" },
    );

    expect(holding.quantity).toBe(6);
    expect(holding.investedAmount).toBeCloseTo(600);
    expect(holding.realizedGain).toBeCloseTo(200); // 600 proceeds - 400 cost
    expect(holding.costBasis).toBeCloseTo(100);
  });

  it("scales proceeds when redemption quantity exceeds holding", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          date: "2026-01-01",
          quantity: 6,
          price: 100,
          amount: 600,
        }),
        txn({
          id: "t2",
          type: "redemption",
          date: "2026-04-01",
          quantity: 10,
          price: 150,
          amount: 1500, // quoted for 10 units; only 6 available
        }),
      ],
      { strategy: "average" },
    );

    // Proceeds scaled to 6/10 * 1500 = 900; cost = 600; gain = 300
    expect(holding.quantity).toBe(0);
    expect(holding.investedAmount).toBe(0);
    expect(holding.realizedGain).toBeCloseTo(300);
  });

  it("requiresQuantity is true for quantity-moving types only", () => {
    expect(requiresQuantity("purchase")).toBe(true);
    expect(requiresQuantity("redemption")).toBe(true);
    expect(requiresQuantity("bonus")).toBe(true);
    expect(requiresQuantity("dividend")).toBe(false);
  });

  it("uses optional valuation instead of last txn price", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          date: "2026-01-01",
          quantity: 10,
          price: 100,
          amount: 1000,
        }),
      ],
      { strategy: "average", valuation: { price: 200, asOf: "2026-06-01" } },
    );

    expect(holding.currentValue).toBe(2000);
    expect(holding.lastPrice).toBe(200);
    expect(holding.lastUpdated).toBe("2026-06-01");
  });

  it("scopes by containerId", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          date: "2026-01-01",
          quantity: 10,
          price: 100,
          amount: 1000,
        }),
        txn({
          id: "t2",
          type: "purchase",
          date: "2026-01-02",
          containerId: "other-folio",
          quantity: 50,
          price: 100,
          amount: 5000,
        }),
      ],
      { strategy: "average" },
    );

    expect(holding.quantity).toBe(10);
    expect(holding.investedAmount).toBe(1000);
  });
});

describe("computePortfolio", () => {
  it("includes liquid cash as an allocation slice", () => {
    const holding = deriveHolding(
      KEY,
      [
        txn({
          id: "t1",
          type: "purchase",
          date: "2026-01-01",
          quantity: 10,
          price: 100,
          amount: 1000,
        }),
      ],
      { strategy: "average", valuation: { price: 100, asOf: "2026-01-01" } },
    );

    const summary = computePortfolio(
      [holding],
      { totalCash: 5000 },
      [MF],
    );

    expect(summary.investmentValue).toBe(1000);
    expect(summary.liquidValue).toBe(5000);
    expect(summary.totalValue).toBe(6000);
    expect(summary.allocationByAssetClass.map((s) => s.key)).toEqual(
      expect.arrayContaining(["mutual_fund", "cash"]),
    );
    expect(summary.allocationByProvider.some((s) => s.key === "PPFAS")).toBe(
      true,
    );
    expect(summary.allocationByCategory.some((s) => s.key === "Flexi Cap")).toBe(
      true,
    );
  });
});
