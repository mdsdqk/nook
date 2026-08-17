/**
 * Instrument catalog types.
 *
 * Domain types are catalog-neutral (no userId). Persistence may attach userId
 * this iteration as a convenience - long-term instruments belong in a shared
 * catalog; users own Holdings, not Instruments.
 */

export type AssetClass = "mutual_fund";
// Future: | "stock" | "etf" | "gold" | "real_estate" | …

export type MutualFundPlan = "direct" | "regular";
export type MutualFundOption = "growth" | "idcw";

export interface MutualFundInstrument {
  assetClass: "mutual_fund";
  id: string;
  name: string;
  currency: string;
  /** Fund house / AMC (also usable as allocation "provider"). */
  provider?: string;
  fundHouse: string;
  schemeName: string;
  schemeCode?: string;
  isin?: string;
  plan: MutualFundPlan;
  option: MutualFundOption;
  category?: string;
}

/** Discriminated instrument union - extend per asset class, not via a metadata bag. */
export type Instrument = MutualFundInstrument;

export interface AssetClassMeta {
  label: string;
}

export const ASSET_CLASS_REGISTRY: Record<AssetClass, AssetClassMeta> = {
  mutual_fund: { label: "Mutual Fund" },
};

export const ASSET_CLASSES = Object.keys(ASSET_CLASS_REGISTRY) as AssetClass[];

export function isAssetClass(value: string): value is AssetClass {
  return value in ASSET_CLASS_REGISTRY;
}

export function isMutualFund(
  instrument: Instrument,
): instrument is MutualFundInstrument {
  return instrument.assetClass === "mutual_fund";
}

export function getAssetClassLabel(assetClass: AssetClass | string): string {
  if (isAssetClass(assetClass)) {
    return ASSET_CLASS_REGISTRY[assetClass].label;
  }
  return assetClass;
}

export function getInstrumentProvider(instrument: Instrument): string | undefined {
  if (isMutualFund(instrument)) {
    return instrument.provider ?? instrument.fundHouse;
  }
  return undefined;
}

export function getInstrumentCategory(instrument: Instrument): string | undefined {
  if (isMutualFund(instrument)) {
    return instrument.category;
  }
  return undefined;
}
