import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUser } from "./lib/auth";
import { upsertManualAssertion } from "./lib/balances";
import { requireUserAccount } from "./lib/ownership";

const assertionValidator = v.object({
  _id: v.id("balanceAssertions"),
  _creationTime: v.number(),
  accountId: v.id("accounts"),
  date: v.string(),
  balance: v.number(),
  source: v.optional(v.string()),
});

export const list = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.array(assertionValidator),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    await requireUserAccount(ctx, user._id, args.accountId);
    const rows = await ctx.db
      .query("balanceAssertions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const assert = mutation({
  args: {
    accountId: v.id("accounts"),
    date: v.string(),
    balance: v.number(),
  },
  returns: v.id("balanceAssertions"),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    await requireUserAccount(ctx, user._id, args.accountId);
    await upsertManualAssertion(ctx, args.accountId, args.date, args.balance);

    const row = await ctx.db
      .query("balanceAssertions")
      .withIndex("by_account_date", (q) =>
        q.eq("accountId", args.accountId).eq("date", args.date),
      )
      .unique();

    if (!row) {
      throw new Error("Failed to upsert balance assertion");
    }
    return row._id;
  },
});
