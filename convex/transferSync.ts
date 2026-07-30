import { v } from "convex/values";
import { matchTransferPairs } from "@nook/domain";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { unlinkTransferPair } from "./lib/transferLinks";

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

function pairLabel(txn: Doc<"transactions">): string | undefined {
  return txn.description ?? txn.merchant ?? txn.narration;
}

export const syncTransfers = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    pairs: v.array(syncedPairValidator),
  }),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const currencyByAccount = new Map(
      accounts.map((account) => [account._id, account.currency]),
    );

    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const matchable = txns.flatMap((txn) => {
      const currency = currencyByAccount.get(txn.accountId);
      if (currency === undefined) return [];
      return [
        {
          id: txn._id,
          accountId: txn.accountId,
          date: txn.date,
          type: txn.type,
          amount: txn.amount,
          currency,
          ...(txn.transferRole !== undefined
            ? { transferRole: txn.transferRole }
            : {}),
          ...(txn.linkedTransactionId !== undefined
            ? { linkedTransactionId: txn.linkedTransactionId }
            : {}),
        },
      ];
    });

    const pairs = matchTransferPairs(matchable);
    const byId = new Map(txns.map((txn) => [txn._id, txn]));
    const synced = [];

    for (const pair of pairs) {
      const outId = pair.outId as Id<"transactions">;
      const inId = pair.inId as Id<"transactions">;
      const outTxn = byId.get(outId);
      const inTxn = byId.get(inId);
      if (!outTxn || !inTxn) continue;

      await ctx.db.patch(outId, {
        type: "transfer",
        category: "Transfer",
        transferRole: "out",
        linkedTransactionId: inId,
      });
      await ctx.db.patch(inId, {
        type: "transfer",
        category: "Transfer",
        transferRole: "in",
        linkedTransactionId: outId,
      });

      const outDescription = pairLabel(outTxn);
      const inDescription = pairLabel(inTxn);

      synced.push({
        outId,
        inId,
        amount: outTxn.amount,
        outAccountId: outTxn.accountId,
        inAccountId: inTxn.accountId,
        outDate: outTxn.date,
        inDate: inTxn.date,
        ...(outDescription !== undefined ? { outDescription } : {}),
        ...(inDescription !== undefined ? { inDescription } : {}),
      });
    }

    return { pairs: synced };
  },
});

export const rejectTransferPairs = mutation({
  args: {
    userId: v.id("users"),
    outIds: v.array(v.id("transactions")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const outId of args.outIds) {
      const outTxn = await ctx.db.get(outId);
      if (!outTxn || outTxn.userId !== args.userId) {
        throw new Error("Transfer pair not found");
      }
      if (
        outTxn.type !== "transfer" ||
        outTxn.transferRole !== "out" ||
        outTxn.linkedTransactionId === undefined
      ) {
        throw new Error("Transaction is not a linked transfer out leg");
      }

      const inTxn = await ctx.db.get(outTxn.linkedTransactionId);
      if (
        !inTxn ||
        inTxn.userId !== args.userId ||
        inTxn.linkedTransactionId !== outId ||
        inTxn.transferRole !== "in"
      ) {
        throw new Error("Transfer pair link is broken");
      }

      await unlinkTransferPair(ctx, outTxn);
    }

    return null;
  },
});
