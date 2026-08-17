import {
  deriveHolding,
  isAssetTransactionType,
  isWealthSourceType,
  type AssetExecutionType,
  type AssetTransaction,
  type CostBasisStrategy,
  type HoldingValuation,
} from "@nook/domain";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const DEFAULT_STRATEGY: CostBasisStrategy = "average";

function toDomainAssetTransaction(
  doc: Doc<"assetTransactions">,
): AssetTransaction | null {
  if (!isAssetTransactionType(doc.type)) return null;
  if (!isWealthSourceType(doc.sourceType)) return null;

  const txn: AssetTransaction = {
    id: doc._id,
    ownerId: doc.userId,
    instrumentId: doc.instrumentId,
    containerId: doc.containerId,
    type: doc.type,
    date: doc.date,
    evidenceId: doc.evidenceId,
    sourceType: doc.sourceType,
  };
  if (doc.executionType !== undefined) {
    txn.executionType = doc.executionType as AssetExecutionType;
  }
  if (doc.quantity !== undefined) txn.quantity = doc.quantity;
  if (doc.price !== undefined) txn.price = doc.price;
  if (doc.amount !== undefined) txn.amount = doc.amount;
  if (doc.bankTransactionId !== undefined) {
    txn.bankTransactionId = doc.bankTransactionId;
  }
  if (doc.externalKey !== undefined) txn.externalKey = doc.externalKey;
  return txn;
}

/**
 * Recompute the materialized holding for one (user, instrument, container).
 * Evidence never calls this - only mutations that write AssetTransactions.
 */
export async function recomputeHolding(
  ctx: MutationCtx,
  userId: Id<"users">,
  instrumentId: Id<"instruments">,
  containerId: string,
  valuation?: HoldingValuation,
): Promise<Id<"holdings"> | null> {
  const rows = await ctx.db
    .query("assetTransactions")
    .withIndex("by_holding_key", (q) =>
      q
        .eq("userId", userId)
        .eq("instrumentId", instrumentId)
        .eq("containerId", containerId),
    )
    .collect();

  const existing = await ctx.db
    .query("holdings")
    .withIndex("by_holding_key", (q) =>
      q
        .eq("userId", userId)
        .eq("instrumentId", instrumentId)
        .eq("containerId", containerId),
    )
    .unique();

  const domainTxns = rows
    .map(toDomainAssetTransaction)
    .filter((t): t is AssetTransaction => t !== null);

  if (domainTxns.length === 0) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  }

  const derived = deriveHolding(
    {
      ownerId: userId,
      instrumentId,
      containerId,
    },
    domainTxns,
    valuation !== undefined
      ? { strategy: DEFAULT_STRATEGY, valuation }
      : { strategy: DEFAULT_STRATEGY },
  );

  const fields: {
    userId: Id<"users">;
    instrumentId: Id<"instruments">;
    containerId: string;
    quantity: number;
    investedAmount: number;
    currentValue: number;
    costBasis: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    lastUpdated: string;
    lastPrice?: number;
    costBasisStrategy: "average";
    realizedGain: number;
  } = {
    userId,
    instrumentId,
    containerId,
    quantity: derived.quantity,
    investedAmount: derived.investedAmount,
    currentValue: derived.currentValue,
    costBasis: derived.costBasis,
    unrealizedGain: derived.unrealizedGain,
    unrealizedGainPercent: derived.unrealizedGainPercent,
    lastUpdated: derived.lastUpdated,
    costBasisStrategy: DEFAULT_STRATEGY,
    realizedGain: derived.realizedGain,
  };
  if (derived.lastPrice !== undefined) {
    fields.lastPrice = derived.lastPrice;
  }

  if (existing) {
    await ctx.db.replace(existing._id, fields);
    return existing._id;
  }

  return await ctx.db.insert("holdings", fields);
}
