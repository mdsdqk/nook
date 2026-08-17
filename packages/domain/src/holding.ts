import {
  ASSET_TRANSACTION_TYPE_REGISTRY,
  type AssetTransaction,
} from "./asset-transaction";

/**
 * Holding identity: owner + instrument + container.
 * A container is the account, folio, wallet, demat, or other logical location
 * where ownership of an instrument is recorded.
 */
export interface HoldingKey {
  ownerId: string;
  instrumentId: string;
  containerId: string;
}

/**
 * Cost basis strategy - pluggable so tax/lot rules are not baked into Holding.
 * Only `"average"` is implemented this iteration (typical for Indian MFs).
 */
export type CostBasisStrategy = "average";
// Future: | "fifo" | "specific_id"

export interface HoldingValuation {
  price: number;
  asOf: string;
}

export interface DeriveHoldingOptions {
  strategy: CostBasisStrategy;
  /**
   * Optional market valuation. When omitted, last transaction price is used
   * as a provisional stand-in - not live market value. Price discovery
   * (e.g. AMFI NAV) is out of scope for this iteration.
   */
  valuation?: HoldingValuation;
}

/**
 * Derived ownership position. Never edit directly - recompute from
 * AssetTransactions via `deriveHolding`.
 */
export interface Holding extends HoldingKey {
  quantity: number;
  investedAmount: number;
  currentValue: number;
  /** Strategy output (e.g. average unit cost under `"average"`). */
  costBasis: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  lastUpdated: string;
  lastPrice?: number;
  costBasisStrategy: CostBasisStrategy;
  /** Realized gain accumulated from cost-reducing events during derivation. */
  realizedGain: number;
}

export function holdingKeyEquals(a: HoldingKey, b: HoldingKey): boolean {
  return (
    a.ownerId === b.ownerId &&
    a.instrumentId === b.instrumentId &&
    a.containerId === b.containerId
  );
}

/**
 * Replay asset transactions into a derived Holding using the given cost strategy.
 * Transactions should belong to a single HoldingKey; unsorted input is sorted by date then id.
 */
export function deriveHolding(
  key: HoldingKey,
  transactions: AssetTransaction[],
  options: DeriveHoldingOptions,
): Holding {
  if (options.strategy !== "average") {
    throw new Error(`Unsupported cost basis strategy: ${options.strategy}`);
  }

  const sorted = [...transactions].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  let quantity = 0;
  let investedAmount = 0;
  let realizedGain = 0;
  let lastPrice: number | undefined;
  let lastUpdated = "";

  for (const txn of sorted) {
    if (
      txn.ownerId !== key.ownerId ||
      txn.instrumentId !== key.instrumentId ||
      txn.containerId !== key.containerId
    ) {
      continue;
    }

    const meta = ASSET_TRANSACTION_TYPE_REGISTRY[txn.type];
    const qty = txn.quantity ?? 0;
    const amount = resolveAmount(txn);
    lastUpdated = txn.date;
    if (txn.price !== undefined) {
      lastPrice = txn.price;
    }

    if (meta.quantitySign > 0 && qty > 0) {
      if (meta.addsToCost) {
        investedAmount += amount;
      }
      quantity += qty;
    } else if (meta.quantitySign < 0 && qty > 0) {
      if (quantity <= 0) {
        continue;
      }
      const redeemQty = Math.min(qty, quantity);
      // Scale proceeds when redeem qty is clamped below the txn quantity.
      const proceeds = amount * (redeemQty / qty);
      const avgCost = investedAmount / quantity;
      const costRelieved = avgCost * redeemQty;
      if (meta.reducesCost) {
        investedAmount = Math.max(0, investedAmount - costRelieved);
        realizedGain += proceeds - costRelieved;
      }
      quantity -= redeemQty;
      if (quantity === 0) {
        investedAmount = 0;
      }
    }
    // dividend / zero-quantity: no position change
  }

  const price =
    options.valuation?.price ?? lastPrice ?? (quantity > 0 ? 0 : undefined);
  const currentValue =
    quantity > 0 && price !== undefined ? quantity * price : 0;
  const costBasis = quantity > 0 ? investedAmount / quantity : 0;
  const unrealizedGain = currentValue - investedAmount;
  const unrealizedGainPercent =
    investedAmount > 0 ? (unrealizedGain / investedAmount) * 100 : 0;

  const holding: Holding = {
    ...key,
    quantity,
    investedAmount,
    currentValue,
    costBasis,
    unrealizedGain,
    unrealizedGainPercent,
    lastUpdated: options.valuation?.asOf ?? lastUpdated,
    costBasisStrategy: options.strategy,
    realizedGain,
  };
  if (price !== undefined) {
    holding.lastPrice = price;
  }
  return holding;
}

function resolveAmount(txn: AssetTransaction): number {
  if (txn.amount !== undefined) return txn.amount;
  if (txn.quantity !== undefined && txn.price !== undefined) {
    return txn.quantity * txn.price;
  }
  return 0;
}
