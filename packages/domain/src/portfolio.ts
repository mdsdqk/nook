import type { Holding } from "./holding";
import {
  getInstrumentCategory,
  getInstrumentProvider,
  type Instrument,
} from "./instrument";

/** Liquid money snapshot consumed read-only from the Money domain. */
export interface LiquidMoneySnapshot {
  totalCash: number;
  byInstitution?: Array<{ institution: string; balance: number }>;
}

export interface PortfolioAllocationSlice {
  key: string;
  value: number;
  percent: number;
}

/**
 * Result of `computePortfolio` - a DTO, not a persisted domain entity.
 */
export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  unrealizedGain: number;
  realizedGain: number;
  liquidValue: number;
  investmentValue: number;
  allocationByAssetClass: PortfolioAllocationSlice[];
  allocationByProvider: PortfolioAllocationSlice[];
  allocationByCategory: PortfolioAllocationSlice[];
}

/**
 * Aggregate holdings + liquid Money balances into portfolio metrics.
 * Pure computation - same pattern as `computeNetWorth(accounts)`.
 */
export function computePortfolio(
  holdings: Holding[],
  liquidMoney: LiquidMoneySnapshot,
  instruments: Instrument[] = [],
): PortfolioSummary {
  const byId = new Map(instruments.map((i) => [i.id, i]));

  let investmentValue = 0;
  let totalInvested = 0;
  let unrealizedGain = 0;
  let realizedGain = 0;

  const classTotals = new Map<string, number>();
  const providerTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();

  for (const holding of holdings) {
    investmentValue += holding.currentValue;
    totalInvested += holding.investedAmount;
    unrealizedGain += holding.unrealizedGain;
    realizedGain += holding.realizedGain;

    const instrument = byId.get(holding.instrumentId);
    const assetClass = instrument?.assetClass ?? "unknown";
    addTo(classTotals, assetClass, holding.currentValue);

    const provider =
      (instrument ? getInstrumentProvider(instrument) : undefined) ?? "unknown";
    addTo(providerTotals, provider, holding.currentValue);

    const category =
      (instrument ? getInstrumentCategory(instrument) : undefined) ?? "uncategorized";
    addTo(categoryTotals, category, holding.currentValue);
  }

  const liquidValue = liquidMoney.totalCash;
  addTo(classTotals, "cash", liquidValue);
  addTo(providerTotals, "cash", liquidValue);
  addTo(categoryTotals, "cash", liquidValue);

  const totalValue = investmentValue + liquidValue;
  // Invested for liquid cash = its face value (no cost basis gap)
  const investedIncludingCash = totalInvested + liquidValue;

  return {
    totalValue,
    totalInvested: investedIncludingCash,
    unrealizedGain,
    realizedGain,
    liquidValue,
    investmentValue,
    allocationByAssetClass: toSlices(classTotals, totalValue),
    allocationByProvider: toSlices(providerTotals, totalValue),
    allocationByCategory: toSlices(categoryTotals, totalValue),
  };
}

function addTo(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function toSlices(
  totals: Map<string, number>,
  totalValue: number,
): PortfolioAllocationSlice[] {
  return [...totals.entries()]
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => ({
      key,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
