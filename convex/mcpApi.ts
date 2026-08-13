/**
 * MCP-facing Convex APIs authenticated by OAuth access-token hash
 * (not Better Auth JWT). Callers pass accessTokenHash + MCP_SERVER_SECRET from the MCP server.
 */
import { isCashflowIn, isSpending, isTransactionType } from "@nook/domain";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { computeBalancesForUser } from "./lib/balances";
import { requireMcpUser } from "./lib/mcpAuth";
import { requireUserAccount } from "./lib/ownership";
import {
  listUnsyncedForUser,
  syncPendingStatementsForUser,
  syncStatementToLedger,
} from "./ledgerSync";
import {
  appendParsedTransactions,
  upsertStatementMetaForUser,
} from "./statements";
import { transactionValidator } from "./transactions";
import { syncTransfersForUser } from "./transferSync";
import {
  computePortfolioForUser,
  createManualInstrumentForUser,
  recordManualAssetTransactionForUser,
  upsertKuveraCapitalGainsForUser,
} from "./wealth";

const mcpAuthArgs = {
  accessTokenHash: v.string(),
  serverSecret: v.string(),
};

const accountWithBalanceValidator = v.object({
  _id: v.id("accounts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  name: v.string(),
  type: v.string(),
  institution: v.optional(v.string()),
  accountFingerprint: v.optional(v.string()),
  accountNumberMasked: v.optional(v.string()),
  currency: v.string(),
  balance: v.number(),
});

const statementListValidator = v.object({
  _id: v.id("parsedStatements"),
  _creationTime: v.number(),
  userId: v.id("users"),
  bank: v.string(),
  accountFingerprint: v.string(),
  accountNumberMasked: v.string(),
  currency: v.string(),
  periodStart: v.string(),
  periodEnd: v.string(),
  openingBalance: v.number(),
  closingBalance: v.number(),
  transactionCount: v.number(),
  contentHash: v.string(),
  sourcePath: v.optional(v.string()),
  status: v.string(),
  validationPassed: v.optional(v.boolean()),
});

const unsyncedStatementValidator = v.object({
  _id: v.id("parsedStatements"),
  bank: v.string(),
  periodStart: v.string(),
  periodEnd: v.string(),
  transactionCount: v.number(),
  accountNumberMasked: v.string(),
});

const syncedPairValidator = v.object({
  outId: v.id("transactions"),
  inId: v.id("transactions"),
  amount: v.number(),
  outAccountId: v.id("accounts"),
  inAccountId: v.id("accounts"),
  outDate: v.string(),
  inDate: v.string(),
  outDescription: v.optional(v.string()),
  inDescription: v.optional(v.string()),
});

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

const parsedTxnValidator = v.object({
  sequence: v.number(),
  date: v.string(),
  narration: v.string(),
  debit: v.optional(v.number()),
  credit: v.optional(v.number()),
  balance: v.number(),
  reference: v.string(),
  externalKey: v.string(),
});

const kuveraLotLeg = v.object({
  date: v.string(),
  value: v.number(),
  nav: v.number(),
});

const kuveraLot = v.object({
  lotIndex: v.number(),
  quantity: v.number(),
  purchase: kuveraLotLeg,
  redemption: kuveraLotLeg,
  acquisitionValue: v.optional(v.number()),
  purchaseExternalKey: v.string(),
  redemptionExternalKey: v.string(),
});

const kuveraScheme = v.object({
  schemeName: v.string(),
  isin: v.string(),
  folio: v.string(),
  category: v.string(),
  plan: v.union(v.literal("direct"), v.literal("regular")),
  option: v.union(v.literal("growth"), v.literal("idcw")),
  instrumentExternalKey: v.string(),
  fundHouse: v.string(),
  lots: v.array(kuveraLot),
});

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const listAccounts = query({
  args: {
    ...mcpAuthArgs,
    asOfDate: v.string(),
  },
  returns: v.array(accountWithBalanceValidator),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const balances = await computeBalancesForUser(ctx, user._id, args.asOfDate);

    return accounts.map((account) => ({
      ...account,
      balance: balances.get(account._id) ?? 0,
    }));
  },
});

export const listTransactions = query({
  args: {
    ...mcpAuthArgs,
    accountId: v.optional(v.id("accounts")),
    type: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("credit"), v.literal("debit"))),
  },
  returns: v.array(transactionValidator),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );

    let rows;
    if (args.accountId) {
      await requireUserAccount(ctx, user._id, args.accountId);
      rows = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      rows = await ctx.db
        .query("transactions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    }

    let filtered = rows;
    if (args.type !== undefined) {
      filtered = filtered.filter((row) => row.type === args.type);
    }
    if (args.direction !== undefined) {
      filtered = filtered.filter((row) => row.direction === args.direction);
    }

    return filtered.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b._creationTime - a._creationTime;
    });
  },
});

export const listStatements = query({
  args: {
    ...mcpAuthArgs,
  },
  returns: v.array(statementListValidator),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    return await ctx.db
      .query("parsedStatements")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listUnsynced = query({
  args: {
    ...mcpAuthArgs,
  },
  returns: v.array(unsyncedStatementValidator),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    return await listUnsyncedForUser(ctx, user._id);
  },
});

export const syncPending = mutation({
  args: {
    ...mcpAuthArgs,
  },
  returns: v.object({
    statementsSynced: v.number(),
    accountsTouched: v.number(),
    transactionsUpserted: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.write",
      args.serverSecret,
    );
    return await syncPendingStatementsForUser(ctx, user._id);
  },
});

export const syncTransfers = mutation({
  args: {
    ...mcpAuthArgs,
  },
  returns: v.object({
    pairs: v.array(syncedPairValidator),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.write",
      args.serverSecret,
    );
    return await syncTransfersForUser(ctx, user._id);
  },
});

export const cashflowTimeline = query({
  args: {
    ...mcpAuthArgs,
    granularity: v.literal("monthly"),
  },
  returns: v.array(
    v.object({
      month: v.string(),
      net: v.number(),
      key: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const buckets = new Map<string, number>();

    for (const txn of txns) {
      if (!isTransactionType(txn.type)) continue;
      if (!isSpending(txn.type) && !isCashflowIn(txn.type)) continue;
      const key = txn.date.slice(0, 7);
      const direction =
        txn.direction ??
        (isCashflowIn(txn.type) ? ("credit" as const) : ("debit" as const));
      const delta = direction === "credit" ? txn.amount : -txn.amount;
      buckets.set(key, (buckets.get(key) ?? 0) + delta);
    }

    void args.granularity;

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, net]) => {
        const monthIndex = Number(key.slice(5, 7)) - 1;
        const month = MONTH_LABELS[monthIndex] ?? key;
        return { key, month, net };
      });
  },
});

export const listInstruments = query({
  args: {
    ...mcpAuthArgs,
  },
  returns: v.array(instrumentValidator),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    return await ctx.db
      .query("instruments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listHoldings = query({
  args: {
    ...mcpAuthArgs,
  },
  returns: v.array(holdingValidator),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    return await ctx.db
      .query("holdings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getPortfolio = query({
  args: {
    ...mcpAuthArgs,
    asOfDate: v.string(),
  },
  returns: portfolioValidator,
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.read",
      args.serverSecret,
    );
    return await computePortfolioForUser(ctx, user._id, args.asOfDate);
  },
});

export const createManualInstrument = mutation({
  args: {
    ...mcpAuthArgs,
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
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.write",
      args.serverSecret,
    );
    const { accessTokenHash: _h, serverSecret: _s, ...rest } = args;
    return await createManualInstrumentForUser(ctx, user._id, rest);
  },
});

export const recordManualAssetTransaction = mutation({
  args: {
    ...mcpAuthArgs,
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
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.write",
      args.serverSecret,
    );
    const { accessTokenHash: _h, serverSecret: _s, ...rest } = args;
    return await recordManualAssetTransactionForUser(ctx, user._id, rest);
  },
});

export const upsertStatementAndSync = mutation({
  args: {
    ...mcpAuthArgs,
    bank: v.string(),
    accountFingerprint: v.string(),
    accountNumberMasked: v.string(),
    currency: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    openingBalance: v.number(),
    closingBalance: v.number(),
    transactionCount: v.number(),
    contentHash: v.string(),
    sourcePath: v.optional(v.string()),
    validationPassed: v.optional(v.boolean()),
    syncLedger: v.optional(v.boolean()),
    transactions: v.array(parsedTxnValidator),
  },
  returns: v.object({
    statementId: v.id("parsedStatements"),
    action: v.union(
      v.literal("created"),
      v.literal("replaced"),
      v.literal("no-op"),
    ),
    syncResult: v.union(
      v.object({
        accountId: v.id("accounts"),
        assertionsUpserted: v.number(),
        transactionsUpserted: v.number(),
        transactionsSkipped: v.number(),
        accountCreated: v.boolean(),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.write",
      args.serverSecret,
    );

    const validationPassed = args.validationPassed ?? true;
    const result = await upsertStatementMetaForUser(ctx, user._id, {
      bank: args.bank,
      accountFingerprint: args.accountFingerprint,
      accountNumberMasked: args.accountNumberMasked,
      currency: args.currency,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      openingBalance: args.openingBalance,
      closingBalance: args.closingBalance,
      transactionCount: args.transactionCount,
      contentHash: args.contentHash,
      ...(args.sourcePath !== undefined ? { sourcePath: args.sourcePath } : {}),
      validationPassed,
    });

    const action: "created" | "replaced" | "no-op" =
      result.action === "created" ||
      result.action === "replaced" ||
      result.action === "no-op"
        ? result.action
        : "created";

    if (action !== "no-op") {
      await appendParsedTransactions(
        ctx,
        result.statementId,
        args.transactions,
      );
    }

    let syncResult: Awaited<ReturnType<typeof syncStatementToLedger>> | null =
      null;
    if (args.syncLedger !== false && validationPassed) {
      syncResult = await syncStatementToLedger(ctx, {
        userId: user._id,
        statementId: result.statementId,
        bank: args.bank,
        accountFingerprint: args.accountFingerprint,
        accountNumberMasked: args.accountNumberMasked,
        currency: args.currency,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        openingBalance: args.openingBalance,
        closingBalance: args.closingBalance,
        transactions: args.transactions.map((t) => ({
          date: t.date,
          narration: t.narration,
          ...(t.debit !== undefined ? { debit: t.debit } : {}),
          ...(t.credit !== undefined ? { credit: t.credit } : {}),
          externalKey: t.externalKey,
        })),
      });
    }

    return {
      statementId: result.statementId,
      action,
      syncResult,
    };
  },
});

export const upsertKuvera = mutation({
  args: {
    ...mcpAuthArgs,
    contentHash: v.string(),
    sourcePath: v.optional(v.string()),
    periodLabel: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    schemes: v.array(kuveraScheme),
  },
  returns: v.object({
    documentId: v.id("wealthDocuments"),
    action: v.union(v.literal("created"), v.literal("unchanged")),
    instrumentsUpserted: v.number(),
    transactionsUpserted: v.number(),
    transactionsSkipped: v.number(),
    holdingsRecomputed: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireMcpUser(
      ctx,
      args.accessTokenHash,
      "nook.write",
      args.serverSecret,
    );
    const { accessTokenHash: _h, serverSecret: _s, ...rest } = args;
    return await upsertKuveraCapitalGainsForUser(ctx, user._id, rest);
  },
});
