import type { WealthSourceType } from "./wealth-source";

/**
 * Economic event types for asset ownership - not execution mechanisms.
 * SIP / STP / SWP are `executionType`, not separate types.
 */
export type AssetTransactionType =
  | "purchase"
  | "redemption"
  | "dividend"
  | "switch_in"
  | "switch_out"
  | "bonus";

export type AssetExecutionType = "sip" | "stp" | "swp" | "lumpsum";

export interface AssetTransactionTypeMeta {
  label: string;
  /** How quantity changes the holding (+1 / -1 / 0). */
  quantitySign: 1 | -1 | 0;
  /** Whether amount increases invested cost (purchase-like). */
  addsToCost: boolean;
  /** Whether amount reduces invested cost / realizes gain (redemption-like). */
  reducesCost: boolean;
}

export const ASSET_TRANSACTION_TYPE_REGISTRY: Record<
  AssetTransactionType,
  AssetTransactionTypeMeta
> = {
  purchase: {
    label: "Purchase",
    quantitySign: 1,
    addsToCost: true,
    reducesCost: false,
  },
  redemption: {
    label: "Redemption",
    quantitySign: -1,
    addsToCost: false,
    reducesCost: true,
  },
  dividend: {
    label: "Dividend",
    quantitySign: 0,
    addsToCost: false,
    reducesCost: false,
  },
  switch_in: {
    label: "Switch In",
    quantitySign: 1,
    addsToCost: true,
    reducesCost: false,
  },
  switch_out: {
    label: "Switch Out",
    quantitySign: -1,
    addsToCost: false,
    reducesCost: true,
  },
  bonus: {
    label: "Bonus",
    quantitySign: 1,
    addsToCost: false,
    reducesCost: false,
  },
};

export const ASSET_TRANSACTION_TYPES = Object.keys(
  ASSET_TRANSACTION_TYPE_REGISTRY,
) as AssetTransactionType[];

export function isAssetTransactionType(
  value: string,
): value is AssetTransactionType {
  return value in ASSET_TRANSACTION_TYPE_REGISTRY;
}

export function getAssetTransactionTypeMeta(
  type: AssetTransactionType,
): AssetTransactionTypeMeta {
  return ASSET_TRANSACTION_TYPE_REGISTRY[type];
}

/** Types that move ownership quantity (purchase, redemption, switch, bonus). */
export function requiresQuantity(type: AssetTransactionType): boolean {
  return ASSET_TRANSACTION_TYPE_REGISTRY[type].quantitySign !== 0;
}

/**
 * Ownership event for an instrument in a container.
 *
 * Identity: primary `id`; when `externalKey` is set, unique on
 * (ownerId, instrumentId, externalKey).
 *
 * `quantity` is class-neutral (MF units, stock shares, gold grams, …).
 */
export interface AssetTransaction {
  id: string;
  ownerId: string;
  instrumentId: string;
  /**
   * Logical location where ownership is recorded: folio, demat, broker
   * account, wallet, vault, etc.
   */
  containerId: string;
  type: AssetTransactionType;
  executionType?: AssetExecutionType;
  date: string;
  quantity?: number;
  price?: number;
  amount?: number;
  evidenceId: string;
  sourceType: WealthSourceType;
  bankTransactionId?: string;
  externalKey?: string;
}
