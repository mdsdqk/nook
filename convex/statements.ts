import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUser } from "./lib/auth";

export const upsertStatement = mutation({
  args: {
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
    transactions: v.array(
      v.object({
        sequence: v.number(),
        date: v.string(),
        narration: v.string(),
        debit: v.optional(v.number()),
        credit: v.optional(v.number()),
        balance: v.number(),
        reference: v.string(),
        externalKey: v.string(),
      }),
    ),
  },
  returns: v.object({
    statementId: v.id("parsedStatements"),
    action: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const { transactions, ...rest } = args;
    const statementData = { ...rest, userId: user._id };

    // Check for existing statement with same dedupe key
    const existing = await ctx.db
      .query("parsedStatements")
      .withIndex("by_dedupe", (q) =>
        q
          .eq("userId", user._id)
          .eq("bank", args.bank)
          .eq("accountFingerprint", args.accountFingerprint)
          .eq("periodStart", args.periodStart)
          .eq("periodEnd", args.periodEnd),
      )
      .first();

    if (existing) {
      // Same content hash → idempotent no-op
      if (existing.contentHash === args.contentHash) {
        return { statementId: existing._id, action: "no-op" };
      }

      // Different hash → re-parse: delete old txns and update statement
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

      await ctx.db.patch(existing._id, {
        ...statementData,
        status: "parsed",
      });

      for (const txn of transactions) {
        await ctx.db.insert("parsedTransactions", {
          statementId: existing._id,
          ...txn,
        });
      }

      return { statementId: existing._id, action: "replaced" };
    }

    // New statement
    const statementId = await ctx.db.insert("parsedStatements", {
      ...statementData,
      status: "parsed",
    });

    for (const txn of transactions) {
      await ctx.db.insert("parsedTransactions", {
        statementId,
        ...txn,
      });
    }

    return { statementId, action: "created" };
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
