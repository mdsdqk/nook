import { v } from "convex/values";
import { ACCOUNT_TYPE_REGISTRY, type AccountType } from "@nook/domain";
import { mutation, query } from "./_generated/server";
import { computeBalancesForUser, upsertManualAssertion } from "./lib/balances";
import { shiftIsoDate } from "./lib/dates";
import { requireUserAccount } from "./lib/ownership";

function assertValidAccountType(type: string): void {
  if (!(type in ACCOUNT_TYPE_REGISTRY)) {
    throw new Error(`Invalid account type: ${type}`);
  }
  const accountType = type as AccountType;
  // Reject category parents that are not leaf product types for new writes,
  // except allow legacy `asset.bank` only via normalize (not create).
  const parent = ACCOUNT_TYPE_REGISTRY[accountType].parent;
  const hasChildren = Object.values(ACCOUNT_TYPE_REGISTRY).some(
    (meta) => meta.parent === accountType,
  );
  if (parent === null || hasChildren) {
    throw new Error(
      `Account type must be a specific product type (e.g. asset.bank.savings), got: ${type}`,
    );
  }
}

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

export const list = query({
  args: {
    userId: v.id("users"),
    asOfDate: v.string(),
  },
  returns: v.array(accountWithBalanceValidator),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const balances = await computeBalancesForUser(
      ctx,
      args.userId,
      args.asOfDate,
    );

    return accounts.map((account) => ({
      ...account,
      balance: balances.get(account._id) ?? 0,
    }));
  },
});

export const get = query({
  args: {
    userId: v.id("users"),
    accountId: v.id("accounts"),
    asOfDate: v.string(),
  },
  returns: v.union(accountWithBalanceValidator, v.null()),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== args.userId) {
      return null;
    }
    const balances = await computeBalancesForUser(
      ctx,
      args.userId,
      args.asOfDate,
    );
    return {
      ...account,
      balance: balances.get(account._id) ?? 0,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    type: v.string(),
    currency: v.string(),
    institution: v.optional(v.string()),
    accountNumberMasked: v.optional(v.string()),
    balance: v.optional(v.number()),
    asOfDate: v.string(),
  },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    assertValidAccountType(args.type);

    const accountId = await ctx.db.insert("accounts", {
      userId: args.userId,
      name: args.name,
      type: args.type,
      currency: args.currency,
      ...(args.institution !== undefined
        ? { institution: args.institution }
        : {}),
      ...(args.accountNumberMasked !== undefined
        ? { accountNumberMasked: args.accountNumberMasked }
        : {}),
    });

    if (args.balance !== undefined) {
      const assertionDate = shiftIsoDate(args.asOfDate, -1);
      await upsertManualAssertion(ctx, accountId, assertionDate, args.balance);
    }

    return accountId;
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("accounts"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    currency: v.optional(v.string()),
    institution: v.optional(v.string()),
    accountNumberMasked: v.optional(v.string()),
    balance: v.optional(v.number()),
    asOfDate: v.optional(v.string()),
  },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    await requireUserAccount(ctx, args.userId, args.accountId);

    if (args.type !== undefined) {
      assertValidAccountType(args.type);
    }

    const patch: {
      name?: string;
      type?: string;
      currency?: string;
      institution?: string;
      accountNumberMasked?: string;
    } = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.type !== undefined) patch.type = args.type;
    if (args.currency !== undefined) patch.currency = args.currency;
    if (args.institution !== undefined) patch.institution = args.institution;
    if (args.accountNumberMasked !== undefined) {
      patch.accountNumberMasked = args.accountNumberMasked;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.accountId, patch);
    }

    if (args.balance !== undefined) {
      if (!args.asOfDate) {
        throw new Error("asOfDate is required when updating balance");
      }
      const assertionDate = shiftIsoDate(args.asOfDate, -1);
      await upsertManualAssertion(
        ctx,
        args.accountId,
        assertionDate,
        args.balance,
      );
    }

    return args.accountId;
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("accounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUserAccount(ctx, args.userId, args.accountId);

    const linkedTxn = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .first();

    if (linkedTxn) {
      throw new Error(
        "Cannot delete account with existing transactions. Remove those transactions first.",
      );
    }

    const assertions = await ctx.db
      .query("balanceAssertions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
    for (const assertion of assertions) {
      await ctx.db.delete(assertion._id);
    }

    await ctx.db.delete(args.accountId);
    return null;
  },
});

/** Map legacy `asset.bank` rows to `asset.bank.savings` (CLI sync default). */
export const normalizeLegacyBankTypes = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let updated = 0;
    for (const account of accounts) {
      if (account.type === "asset.bank") {
        await ctx.db.patch(account._id, { type: "asset.bank.savings" });
        updated++;
      }
    }
    return { updated };
  },
});
