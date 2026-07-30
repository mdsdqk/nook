import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserAccount } from "./lib/ownership";

const transactionValidator = v.object({
  _id: v.id("transactions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  accountId: v.id("accounts"),
  date: v.string(),
  type: v.string(),
  amount: v.number(),
  description: v.optional(v.string()),
  narration: v.optional(v.string()),
  merchant: v.optional(v.string()),
  category: v.optional(v.string()),
  notes: v.optional(v.string()),
  externalKey: v.optional(v.string()),
  source: v.optional(v.string()),
  statementId: v.optional(v.id("parsedStatements")),
});

const ALLOWED_TYPES = new Set([
  "income",
  "expense",
  "transfer",
  "obligation",
]);

export const list = query({
  args: {
    userId: v.id("users"),
    accountId: v.optional(v.id("accounts")),
    type: v.optional(v.string()),
  },
  returns: v.array(transactionValidator),
  handler: async (ctx, args) => {
    let rows;
    if (args.accountId) {
      await requireUserAccount(ctx, args.userId, args.accountId);
      rows = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      rows = await ctx.db
        .query("transactions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const filtered =
      args.type !== undefined
        ? rows.filter((row) => row.type === args.type)
        : rows;

    return filtered.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b._creationTime - a._creationTime;
    });
  },
});

export const get = query({
  args: {
    userId: v.id("users"),
    transactionId: v.id("transactions"),
  },
  returns: v.union(transactionValidator, v.null()),
  handler: async (ctx, args) => {
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.userId !== args.userId) {
      return null;
    }
    return txn;
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("accounts"),
    date: v.string(),
    type: v.string(),
    amount: v.number(),
    description: v.optional(v.string()),
    narration: v.optional(v.string()),
    merchant: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    await requireUserAccount(ctx, args.userId, args.accountId);

    if (!ALLOWED_TYPES.has(args.type)) {
      throw new Error("Invalid transaction type");
    }
    if (!(args.amount > 0)) {
      throw new Error("Amount must be greater than zero");
    }

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      accountId: args.accountId,
      date: args.date,
      type: args.type,
      amount: args.amount,
      source: "manual",
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      ...(args.narration !== undefined ? { narration: args.narration } : {}),
      ...(args.merchant !== undefined ? { merchant: args.merchant } : {}),
      ...(args.category !== undefined ? { category: args.category } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    });
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    transactionId: v.id("transactions"),
    accountId: v.optional(v.id("accounts")),
    date: v.optional(v.string()),
    type: v.optional(v.string()),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
    narration: v.optional(v.string()),
    merchant: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.userId !== args.userId) {
      throw new Error("Transaction not found");
    }

    if (args.accountId !== undefined) {
      await requireUserAccount(ctx, args.userId, args.accountId);
    }
    if (args.type !== undefined && !ALLOWED_TYPES.has(args.type)) {
      throw new Error("Invalid transaction type");
    }
    if (args.amount !== undefined && !(args.amount > 0)) {
      throw new Error("Amount must be greater than zero");
    }

    const patch: Record<string, string | number | undefined> = {};
    if (args.accountId !== undefined) patch.accountId = args.accountId;
    if (args.date !== undefined) patch.date = args.date;
    if (args.type !== undefined) patch.type = args.type;
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.description !== undefined) patch.description = args.description;
    if (args.narration !== undefined) patch.narration = args.narration;
    if (args.merchant !== undefined) patch.merchant = args.merchant;
    if (args.category !== undefined) patch.category = args.category;
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(args.transactionId, patch);
    return args.transactionId;
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
    transactionId: v.id("transactions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.userId !== args.userId) {
      throw new Error("Transaction not found");
    }
    await ctx.db.delete(args.transactionId);
    return null;
  },
});
