import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAppUser } from "./lib/auth";
import { consumeCliUpsertQuota } from "./importRateLimit";
import { sanitizeSourcePath } from "./lib/importPolicy";

const txnValidator = v.object({
  sequence: v.number(),
  date: v.string(),
  narration: v.string(),
  debit: v.optional(v.number()),
  credit: v.optional(v.number()),
  balance: v.number(),
  reference: v.string(),
  externalKey: v.string(),
});

const upsertMetaArgs = {
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
};

type UpsertMeta = {
  bank: string;
  accountFingerprint: string;
  accountNumberMasked: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  transactionCount: number;
  contentHash: string;
  sourcePath?: string;
  validationPassed: boolean;
};

type TxnRow = {
  sequence: number;
  date: string;
  narration: string;
  debit?: number;
  credit?: number;
  balance: number;
  reference: string;
  externalKey: string;
};

async function upsertStatementMetaForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: UpsertMeta,
): Promise<{ statementId: Id<"parsedStatements">; action: string }> {
  const sourcePath =
    args.sourcePath !== undefined
      ? sanitizeSourcePath(args.sourcePath)
      : undefined;

  const statementData = {
    userId,
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
    ...(sourcePath !== undefined ? { sourcePath } : {}),
    status: args.validationPassed ? "parsed" : "parsed_invalid",
    validationPassed: args.validationPassed,
  };

  const existing = await ctx.db
    .query("parsedStatements")
    .withIndex("by_dedupe", (q) =>
      q
        .eq("userId", userId)
        .eq("bank", args.bank)
        .eq("accountFingerprint", args.accountFingerprint)
        .eq("periodStart", args.periodStart)
        .eq("periodEnd", args.periodEnd),
    )
    .first();

  if (existing) {
    if (existing.contentHash === args.contentHash) {
      await ctx.db.patch(existing._id, {
        validationPassed: args.validationPassed,
        status: statementData.status,
      });
      return { statementId: existing._id, action: "no-op" };
    }

    const oldTxns = await ctx.db
      .query("parsedTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", existing._id))
      .collect();
    for (const txn of oldTxns) {
      await ctx.db.delete(txn._id);
    }
    const oldLedgerRows = await ctx.db
      .query("transactions")
      .withIndex("by_statement", (q) => q.eq("statementId", existing._id))
      .collect();
    for (const row of oldLedgerRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.patch(existing._id, statementData);
    return { statementId: existing._id, action: "replaced" };
  }

  const statementId = await ctx.db.insert("parsedStatements", statementData);
  return { statementId, action: "created" };
}

async function appendParsedTransactions(
  ctx: MutationCtx,
  statementId: Id<"parsedStatements">,
  transactions: TxnRow[],
): Promise<void> {
  for (const txn of transactions) {
    await ctx.db.insert("parsedTransactions", {
      statementId,
      sequence: txn.sequence,
      date: txn.date,
      narration: txn.narration,
      ...(txn.debit !== undefined ? { debit: txn.debit } : {}),
      ...(txn.credit !== undefined ? { credit: txn.credit } : {}),
      balance: txn.balance,
      reference: txn.reference,
      externalKey: txn.externalKey,
    });
  }
}

function asActionLiteral(
  action: string,
): "created" | "replaced" | "no-op" {
  if (action === "created" || action === "replaced" || action === "no-op") {
    return action;
  }
  return "created";
}

/** CLI + legacy clients. Rate-limited. Prefer Spiky import action for PDF trust. */
export const upsertStatement = mutation({
  args: {
    ...upsertMetaArgs,
    validationPassed: v.optional(v.boolean()),
    transactions: v.array(txnValidator),
  },
  returns: v.object({
    statementId: v.id("parsedStatements"),
    action: v.union(
      v.literal("created"),
      v.literal("replaced"),
      v.literal("no-op"),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    await consumeCliUpsertQuota(ctx, user._id, user.username);

    const { transactions, validationPassed, ...rest } = args;
    const result = await upsertStatementMetaForUser(ctx, user._id, {
      ...rest,
      validationPassed: validationPassed ?? true,
    });

    if (result.action !== "no-op") {
      await appendParsedTransactions(ctx, result.statementId, transactions);
    }

    return {
      statementId: result.statementId,
      action: asActionLiteral(result.action),
    };
  },
});

/** Called from Node import action after PDF parse. */
export const upsertStatementMetaFromImport = internalMutation({
  args: {
    ...upsertMetaArgs,
    validationPassed: v.boolean(),
  },
  returns: v.object({
    statementId: v.id("parsedStatements"),
    action: v.union(
      v.literal("created"),
      v.literal("replaced"),
      v.literal("no-op"),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const result = await upsertStatementMetaForUser(ctx, user._id, args);
    return {
      statementId: result.statementId,
      action: asActionLiteral(result.action),
    };
  },
});

export const appendParsedTransactionChunk = internalMutation({
  args: {
    statementId: v.id("parsedStatements"),
    transactions: v.array(txnValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const statement = await ctx.db.get(args.statementId);
    if (!statement || statement.userId !== user._id) {
      throw new Error("Statement not found");
    }
    await appendParsedTransactions(ctx, args.statementId, args.transactions);
    return null;
  },
});

export const listStatements = query({
  args: {},
  returns: v.array(
    v.object({
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
    }),
  ),
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    return await ctx.db
      .query("parsedStatements")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
