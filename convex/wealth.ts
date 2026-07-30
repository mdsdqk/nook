import {
  ASSET_TRANSACTION_TYPES,
  computePortfolio,
  isAssetTransactionType,
  isBankAccountType,
  requiresQuantity,
  type AssetExecutionType,
  type Holding,
  type Instrument,
  type MutualFundInstrument,
} from "@nook/domain";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { computeBalancesForUser } from "./lib/balances";
import { recomputeHolding } from "./lib/holdings";

const EXECUTION_TYPES = new Set(["sip", "stp", "swp", "lumpsum"]);

const instrumentValidator = v.object({
  _id: v.id("instruments"),
  _creationTime: v.number(),
  userId: v.id("users"),
  assetClass: v.literal("mutual_fund"),
  name: v.string(),
  currency: v.string(),
  provider: v.optional(v.string()),
  fundHouse: v.string(),
  schemeName: v.string(),
  schemeCode: v.optional(v.string()),
  isin: v.optional(v.string()),
  plan: v.union(v.literal("direct"), v.literal("regular")),
  option: v.union(v.literal("growth"), v.literal("idcw")),
  category: v.optional(v.string()),
  externalKey: v.optional(v.string()),
});

const holdingValidator = v.object({
  _id: v.id("holdings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  instrumentId: v.id("instruments"),
  containerId: v.string(),
  quantity: v.number(),
  investedAmount: v.number(),
  currentValue: v.number(),
  costBasis: v.number(),
  unrealizedGain: v.number(),
  unrealizedGainPercent: v.number(),
  lastUpdated: v.string(),
  lastPrice: v.optional(v.number()),
  costBasisStrategy: v.literal("average"),
  realizedGain: v.number(),
});

const allocationSliceValidator = v.object({
  key: v.string(),
  value: v.number(),
  percent: v.number(),
});

const portfolioValidator = v.object({
  totalValue: v.number(),
  totalInvested: v.number(),
  unrealizedGain: v.number(),
  realizedGain: v.number(),
  liquidValue: v.number(),
  investmentValue: v.number(),
  allocationByAssetClass: v.array(allocationSliceValidator),
  allocationByProvider: v.array(allocationSliceValidator),
  allocationByCategory: v.array(allocationSliceValidator),
});

function toDomainInstrument(doc: Doc<"instruments">): Instrument {
  const mf: MutualFundInstrument = {
    assetClass: "mutual_fund",
    id: doc._id,
    name: doc.name,
    currency: doc.currency,
    fundHouse: doc.fundHouse,
    schemeName: doc.schemeName,
    plan: doc.plan,
    option: doc.option,
  };
  if (doc.provider !== undefined) mf.provider = doc.provider;
  if (doc.schemeCode !== undefined) mf.schemeCode = doc.schemeCode;
  if (doc.isin !== undefined) mf.isin = doc.isin;
  if (doc.category !== undefined) mf.category = doc.category;
  return mf;
}

function isLiquidMoneyAccount(type: string): boolean {
  return (
    isBankAccountType(type) ||
    type === "asset.cash" ||
    type === "asset.wallet"
  );
}

async function requireUserInstrument(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  instrumentId: Id<"instruments">,
): Promise<Doc<"instruments">> {
  const instrument = await ctx.db.get(instrumentId);
  if (!instrument || instrument.userId !== userId) {
    throw new Error("Instrument not found");
  }
  return instrument;
}

function optionalEqual<T>(a: T | undefined, b: T | undefined): boolean {
  return a === b;
}

/**
 * Same externalKey must replay the same economic event on the same holding key.
 * Conflicting retries throw rather than silently returning the wrong transaction.
 */
function assertIdempotentReplay(
  existing: Doc<"assetTransactions">,
  args: {
    containerId: string;
    type: string;
    date: string;
    executionType?: string;
    quantity?: number;
    price?: number;
    amount?: number;
  },
): void {
  const mismatches: string[] = [];
  if (existing.containerId !== args.containerId) {
    mismatches.push("containerId");
  }
  if (existing.type !== args.type) mismatches.push("type");
  if (existing.date !== args.date) mismatches.push("date");
  if (!optionalEqual(existing.executionType, args.executionType)) {
    mismatches.push("executionType");
  }
  if (!optionalEqual(existing.quantity, args.quantity)) {
    mismatches.push("quantity");
  }
  if (!optionalEqual(existing.price, args.price)) mismatches.push("price");
  if (!optionalEqual(existing.amount, args.amount)) mismatches.push("amount");

  if (mismatches.length > 0) {
    throw new Error(
      `Asset transaction externalKey conflict: existing row differs on ${mismatches.join(", ")}`,
    );
  }
}

/**
 * Create a mutual-fund instrument for manual wealth entry.
 * userId scoping is a temporary convenience — long-term instruments are shared catalog rows.
 */
export const createManualInstrument = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    currency: v.string(),
    fundHouse: v.string(),
    schemeName: v.string(),
    plan: v.union(v.literal("direct"), v.literal("regular")),
    option: v.union(v.literal("growth"), v.literal("idcw")),
    provider: v.optional(v.string()),
    schemeCode: v.optional(v.string()),
    isin: v.optional(v.string()),
    category: v.optional(v.string()),
    externalKey: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("instruments"),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    if (args.externalKey !== undefined) {
      const existing = await ctx.db
        .query("instruments")
        .withIndex("by_external_key", (q) =>
          q.eq("userId", args.userId).eq("externalKey", args.externalKey!),
        )
        .first();
      if (existing) return existing._id;
    }

    // Provenance for catalog entry; does not create Holdings.
    await ctx.db.insert("wealthEvidence", {
      userId: args.userId,
      sourceType: "manual",
      note: args.note ?? `Manual instrument: ${args.name}`,
      createdAt: Date.now(),
    });

    const row: {
      userId: Id<"users">;
      assetClass: "mutual_fund";
      name: string;
      currency: string;
      provider: string;
      fundHouse: string;
      schemeName: string;
      schemeCode?: string;
      isin?: string;
      plan: "direct" | "regular";
      option: "growth" | "idcw";
      category?: string;
      externalKey?: string;
    } = {
      userId: args.userId,
      assetClass: "mutual_fund",
      name: args.name,
      currency: args.currency,
      provider: args.provider ?? args.fundHouse,
      fundHouse: args.fundHouse,
      schemeName: args.schemeName,
      plan: args.plan,
      option: args.option,
    };
    if (args.schemeCode !== undefined) row.schemeCode = args.schemeCode;
    if (args.isin !== undefined) row.isin = args.isin;
    if (args.category !== undefined) row.category = args.category;
    if (args.externalKey !== undefined) row.externalKey = args.externalKey;

    return await ctx.db.insert("instruments", row);
  },
});

/**
 * Record a manual asset transaction.
 * Inserts evidence → asset transaction → recomputes Holding.
 * Evidence alone never updates Holdings.
 */
export const recordManualAssetTransaction = mutation({
  args: {
    userId: v.id("users"),
    instrumentId: v.id("instruments"),
    containerId: v.string(),
    type: v.string(),
    date: v.string(),
    executionType: v.optional(v.string()),
    quantity: v.optional(v.number()),
    price: v.optional(v.number()),
    amount: v.optional(v.number()),
    externalKey: v.optional(v.string()),
    note: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    bankTransactionId: v.optional(v.id("transactions")),
  },
  returns: v.object({
    evidenceId: v.id("wealthEvidence"),
    transactionId: v.id("assetTransactions"),
    holdingId: v.union(v.id("holdings"), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireUserInstrument(ctx, args.userId, args.instrumentId);

    if (!isAssetTransactionType(args.type)) {
      throw new Error(
        `Invalid asset transaction type: ${args.type}. Expected one of ${ASSET_TRANSACTION_TYPES.join(", ")}`,
      );
    }
    if (requiresQuantity(args.type)) {
      if (args.quantity === undefined || !(args.quantity > 0)) {
        throw new Error(
          `Asset transaction type "${args.type}" requires a positive quantity`,
        );
      }
    }
    if (
      args.executionType !== undefined &&
      !EXECUTION_TYPES.has(args.executionType)
    ) {
      throw new Error(`Invalid executionType: ${args.executionType}`);
    }
    if (args.bankTransactionId !== undefined) {
      const bankTxn = await ctx.db.get(args.bankTransactionId);
      if (!bankTxn || bankTxn.userId !== args.userId) {
        throw new Error("Bank transaction not found");
      }
    }

    if (args.externalKey !== undefined) {
      const dup = await ctx.db
        .query("assetTransactions")
        .withIndex("by_owner_instrument_external_key", (q) =>
          q
            .eq("userId", args.userId)
            .eq("instrumentId", args.instrumentId)
            .eq("externalKey", args.externalKey!),
        )
        .first();
      if (dup) {
        assertIdempotentReplay(dup, args);
        const holding = await ctx.db
          .query("holdings")
          .withIndex("by_holding_key", (q) =>
            q
              .eq("userId", args.userId)
              .eq("instrumentId", args.instrumentId)
              .eq("containerId", dup.containerId),
          )
          .unique();
        return {
          evidenceId: dup.evidenceId,
          transactionId: dup._id,
          holdingId: holding?._id ?? null,
        };
      }
    }

    const evidenceRow: {
      userId: Id<"users">;
      sourceType: "manual";
      referenceId?: string;
      note?: string;
      createdAt: number;
    } = {
      userId: args.userId,
      sourceType: "manual",
      createdAt: Date.now(),
    };
    if (args.referenceId !== undefined) evidenceRow.referenceId = args.referenceId;
    if (args.note !== undefined) evidenceRow.note = args.note;

    const evidenceId = await ctx.db.insert("wealthEvidence", evidenceRow);

    const txnRow: {
      userId: Id<"users">;
      instrumentId: Id<"instruments">;
      containerId: string;
      type: string;
      executionType?: string;
      date: string;
      quantity?: number;
      price?: number;
      amount?: number;
      evidenceId: Id<"wealthEvidence">;
      sourceType: "manual";
      bankTransactionId?: Id<"transactions">;
      externalKey?: string;
    } = {
      userId: args.userId,
      instrumentId: args.instrumentId,
      containerId: args.containerId,
      type: args.type,
      date: args.date,
      evidenceId,
      sourceType: "manual",
    };
    if (args.executionType !== undefined) {
      txnRow.executionType = args.executionType as AssetExecutionType;
    }
    if (args.quantity !== undefined) txnRow.quantity = args.quantity;
    if (args.price !== undefined) txnRow.price = args.price;
    if (args.amount !== undefined) txnRow.amount = args.amount;
    if (args.bankTransactionId !== undefined) {
      txnRow.bankTransactionId = args.bankTransactionId;
    }
    if (args.externalKey !== undefined) txnRow.externalKey = args.externalKey;

    const transactionId = await ctx.db.insert("assetTransactions", txnRow);

    const holdingId = await recomputeHolding(
      ctx,
      args.userId,
      args.instrumentId,
      args.containerId,
    );

    return { evidenceId, transactionId, holdingId };
  },
});

/** Optional link only — does not change holding math. */
export const linkBankTransaction = mutation({
  args: {
    userId: v.id("users"),
    assetTransactionId: v.id("assetTransactions"),
    bankTransactionId: v.union(v.id("transactions"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assetTxn = await ctx.db.get(args.assetTransactionId);
    if (!assetTxn || assetTxn.userId !== args.userId) {
      throw new Error("Asset transaction not found");
    }

    if (args.bankTransactionId !== null) {
      const bankTxn = await ctx.db.get(args.bankTransactionId);
      if (!bankTxn || bankTxn.userId !== args.userId) {
        throw new Error("Bank transaction not found");
      }
      await ctx.db.patch(args.assetTransactionId, {
        bankTransactionId: args.bankTransactionId,
      });
    } else {
      await ctx.db.patch(args.assetTransactionId, {
        bankTransactionId: undefined,
      });
    }

    return null;
  },
});

export const listInstruments = query({
  args: { userId: v.id("users") },
  returns: v.array(instrumentValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instruments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const listHoldings = query({
  args: { userId: v.id("users") },
  returns: v.array(holdingValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("holdings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Portfolio DTO — computation only, not a stored entity.
 * Liquid cash is read-only from Money accounts.
 */
export const getPortfolio = query({
  args: {
    userId: v.id("users"),
    asOfDate: v.string(),
  },
  returns: portfolioValidator,
  handler: async (ctx, args) => {
    const holdings = await ctx.db
      .query("holdings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const instrumentDocs = await ctx.db
      .query("instruments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const balances = await computeBalancesForUser(
      ctx,
      args.userId,
      args.asOfDate,
    );

    let totalCash = 0;
    const byInstitution = new Map<string, number>();
    for (const account of accounts) {
      if (!isLiquidMoneyAccount(account.type)) continue;
      const balance = balances.get(account._id) ?? 0;
      totalCash += balance;
      const institution = account.institution ?? account.name;
      byInstitution.set(
        institution,
        (byInstitution.get(institution) ?? 0) + balance,
      );
    }

    const domainHoldings: Holding[] = holdings.map((h) => {
      const holding: Holding = {
        ownerId: h.userId,
        instrumentId: h.instrumentId,
        containerId: h.containerId,
        quantity: h.quantity,
        investedAmount: h.investedAmount,
        currentValue: h.currentValue,
        costBasis: h.costBasis,
        unrealizedGain: h.unrealizedGain,
        unrealizedGainPercent: h.unrealizedGainPercent,
        lastUpdated: h.lastUpdated,
        costBasisStrategy: h.costBasisStrategy,
        realizedGain: h.realizedGain,
      };
      if (h.lastPrice !== undefined) holding.lastPrice = h.lastPrice;
      return holding;
    });

    return computePortfolio(
      domainHoldings,
      {
        totalCash,
        byInstitution: [...byInstitution.entries()].map(
          ([institution, balance]) => ({ institution, balance }),
        ),
      },
      instrumentDocs.map(toDomainInstrument),
    );
  },
});
