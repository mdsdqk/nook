import { TRANSACTION_TYPES, isTransactionType } from "@nook/domain";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUser } from "./lib/auth";
import { requireUserAccount } from "./lib/ownership";
import {
  deleteTransferLeg,
  isLinkedTransfer,
  unlinkTransferPair,
} from "./lib/transferLinks";

export const transactionValidator = v.object({
  _id: v.id("transactions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  accountId: v.id("accounts"),
  date: v.string(),
  direction: v.union(v.literal("credit"), v.literal("debit")),
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
  linkedTransactionId: v.optional(v.id("transactions")),
  transferRole: v.optional(v.union(v.literal("out"), v.literal("in"))),
});

const ALLOWED_TYPES = new Set<string>(TRANSACTION_TYPES);
const ALLOWED_DIRECTIONS = new Set(["credit", "debit"]);

function breaksTransferLink(
  txn: {
    accountId: string;
    type: string;
    amount: number;
    direction?: string;
    linkedTransactionId?: string;
  },
  args: {
    accountId?: string;
    type?: string;
    amount?: number;
    direction?: string;
  },
): boolean {
  if (!isLinkedTransfer(txn)) return false;
  if (args.accountId !== undefined && args.accountId !== txn.accountId) {
    return true;
  }
  if (args.type !== undefined && args.type !== txn.type) return true;
  if (args.direction !== undefined && args.direction !== txn.direction) {
    return true;
  }
  if (args.amount !== undefined && args.amount !== txn.amount) return true;
  return false;
}

export const list = query({
  args: {
    accountId: v.optional(v.id("accounts")),
    type: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("credit"), v.literal("debit"))),
  },
  returns: v.array(transactionValidator),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
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

export const get = query({
  args: {
    transactionId: v.id("transactions"),
  },
  returns: v.union(transactionValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.userId !== user._id) {
      return null;
    }
    return txn;
  },
});

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    date: v.string(),
    direction: v.union(v.literal("credit"), v.literal("debit")),
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
    const user = await getAppUser(ctx);
    await requireUserAccount(ctx, user._id, args.accountId);

    if (!ALLOWED_DIRECTIONS.has(args.direction)) {
      throw new Error("Invalid transaction direction");
    }
    if (!ALLOWED_TYPES.has(args.type) || !isTransactionType(args.type)) {
      throw new Error("Invalid transaction type");
    }
    if (!(args.amount > 0)) {
      throw new Error("Amount must be greater than zero");
    }

    return await ctx.db.insert("transactions", {
      userId: user._id,
      accountId: args.accountId,
      date: args.date,
      direction: args.direction,
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
    transactionId: v.id("transactions"),
    accountId: v.optional(v.id("accounts")),
    date: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("credit"), v.literal("debit"))),
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
    const user = await getAppUser(ctx);
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.userId !== user._id) {
      throw new Error("Transaction not found");
    }

    if (args.accountId !== undefined) {
      await requireUserAccount(ctx, user._id, args.accountId);
    }
    if (
      args.direction !== undefined &&
      !ALLOWED_DIRECTIONS.has(args.direction)
    ) {
      throw new Error("Invalid transaction direction");
    }
    if (
      args.type !== undefined &&
      (!ALLOWED_TYPES.has(args.type) || !isTransactionType(args.type))
    ) {
      throw new Error("Invalid transaction type");
    }
    if (args.amount !== undefined && !(args.amount > 0)) {
      throw new Error("Amount must be greater than zero");
    }

    // Structural edits break transfer pairing — unlink both legs first.
    if (breaksTransferLink(txn, args)) {
      await unlinkTransferPair(ctx, txn);
    }

    // Re-read after possible unlink/replace.
    const current = await ctx.db.get(args.transactionId);
    if (!current || current.userId !== user._id) {
      throw new Error("Transaction not found");
    }

    const patch: Record<string, string | number | undefined> = {};
    if (args.accountId !== undefined) patch.accountId = args.accountId;
    if (args.date !== undefined) patch.date = args.date;
    if (args.direction !== undefined) patch.direction = args.direction;
    if (args.type !== undefined) patch.type = args.type;
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.description !== undefined) patch.description = args.description;
    if (args.narration !== undefined) patch.narration = args.narration;
    if (args.merchant !== undefined) patch.merchant = args.merchant;
    if (args.notes !== undefined) patch.notes = args.notes;

    const clearCategory =
      args.category !== undefined && args.category.trim() === "";
    if (args.category !== undefined && !clearCategory) {
      patch.category = args.category;
    }

    if (clearCategory) {
      const {
        _id: _ignoredId,
        _creationTime: _ignoredCreation,
        category: _category,
        ...rest
      } = current;
      await ctx.db.replace(args.transactionId, {
        ...rest,
        ...patch,
      });
    } else {
      await ctx.db.patch(args.transactionId, patch);
    }
    return args.transactionId;
  },
});

export const remove = mutation({
  args: {
    transactionId: v.id("transactions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.userId !== user._id) {
      throw new Error("Transaction not found");
    }
    await deleteTransferLeg(ctx, txn);
    return null;
  },
});
