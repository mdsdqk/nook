import { v } from "convex/values";
import { matchTransferPairs } from "@nook/domain";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getAppUser } from "./lib/auth";
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

async function linkTransferLeg(
  ctx: MutationCtx,
  txn: Doc<"transactions">,
  link: {
    type: "internal_transfer";
    direction: "credit" | "debit";
    transferRole: "out" | "in";
    linkedTransactionId: Id<"transactions">;
  },
): Promise<void> {
  if (txn.category === "Transfer") {
    const {
      _id: _ignoredId,
      _creationTime: _ignoredCreation,
      linkedTransactionId: _linked,
      transferRole: _role,
      category: _category,
      ...rest
    } = txn;
    await ctx.db.replace(txn._id, {
      ...rest,
      ...link,
    });
    return;
  }

  await ctx.db.patch(txn._id, link);
}

function isLinkedTransferOut(
  txn: Doc<"transactions">,
): txn is Doc<"transactions"> & {
  transferRole: "out";
  linkedTransactionId: Id<"transactions">;
} {
  return (
    (txn.type === "internal_transfer" || txn.type === "transfer") &&
    txn.transferRole === "out" &&
    txn.linkedTransactionId !== undefined
  );
}

export type SyncedTransferPair = {
  outId: Id<"transactions">;
  inId: Id<"transactions">;
  amount: number;
  outAccountId: Id<"accounts">;
  inAccountId: Id<"accounts">;
  outDate: string;
  inDate: string;
  outDescription?: string;
  inDescription?: string;
};

export async function syncTransfersForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ pairs: SyncedTransferPair[] }> {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const currencyByAccount = new Map(
    accounts.map((account) => [account._id, account.currency]),
  );

  const txns = await ctx.db
    .query("transactions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
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
        ...(txn.direction !== undefined ? { direction: txn.direction } : {}),
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
  const synced: SyncedTransferPair[] = [];

  for (const pair of pairs) {
    const outId = pair.outId as Id<"transactions">;
    const inId = pair.inId as Id<"transactions">;
    const outTxn = byId.get(outId);
    const inTxn = byId.get(inId);
    if (!outTxn || !inTxn) continue;

    await linkTransferLeg(ctx, outTxn, {
      type: "internal_transfer",
      direction: "debit",
      transferRole: "out",
      linkedTransactionId: inId,
    });
    await linkTransferLeg(ctx, inTxn, {
      type: "internal_transfer",
      direction: "credit",
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
}

export const syncTransfers = mutation({
  args: {},
  returns: v.object({
    pairs: v.array(syncedPairValidator),
  }),
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    return await syncTransfersForUser(ctx, user._id);
  },
});

export const rejectTransferPairs = mutation({
  args: {
    outIds: v.array(v.id("transactions")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    for (const outId of args.outIds) {
      const outTxn = await ctx.db.get(outId);
      if (!outTxn || outTxn.userId !== user._id) {
        throw new Error("Transfer pair not found");
      }
      if (!isLinkedTransferOut(outTxn)) {
        throw new Error("Transaction is not a linked transfer out leg");
      }

      const inTxn = await ctx.db.get(outTxn.linkedTransactionId);
      if (
        !inTxn ||
        inTxn.userId !== user._id ||
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
