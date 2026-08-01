import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAppUser } from "./lib/auth";
import { shiftIsoDate } from "./lib/dates";

type SyncStatementArgs = {
  userId: Id<"users">;
  statementId: Id<"parsedStatements">;
  bank: string;
  accountFingerprint: string;
  accountNumberMasked: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  transactions: Array<{
    date: string;
    narration: string;
    debit?: number;
    credit?: number;
    externalKey: string;
  }>;
};

type SyncStatementResult = {
  accountId: Id<"accounts">;
  assertionsUpserted: number;
  transactionsUpserted: number;
  transactionsSkipped: number;
};

export async function syncStatementToLedger(
  ctx: MutationCtx,
  args: SyncStatementArgs,
): Promise<SyncStatementResult> {
  let account = await ctx.db
    .query("accounts")
    .withIndex("by_fingerprint", (q) =>
      q
        .eq("userId", args.userId)
        .eq("institution", args.bank)
        .eq("accountFingerprint", args.accountFingerprint),
    )
    .first();

  if (!account) {
    const accountId = await ctx.db.insert("accounts", {
      userId: args.userId,
      name: `${args.bank} ${args.accountNumberMasked}`,
      type: "asset.bank.savings",
      institution: args.bank,
      accountFingerprint: args.accountFingerprint,
      accountNumberMasked: args.accountNumberMasked,
      currency: args.currency,
    });
    account = (await ctx.db.get(accountId))!;
  } else if (account.type === "asset.bank") {
    await ctx.db.patch(account._id, { type: "asset.bank.savings" });
    account = (await ctx.db.get(account._id))!;
  }

  const accountId = account._id;

  const maxTxnDate =
    args.transactions.length > 0
      ? (args.transactions
          .map((t) => t.date)
          .sort((a, b) => a.localeCompare(b))
          .at(-1) ?? args.periodEnd)
      : args.periodEnd;
  const openingAssertionDate = shiftIsoDate(args.periodStart, -1);
  const closingAssertionDate =
    maxTxnDate > args.periodEnd ? maxTxnDate : args.periodEnd;

  let assertionsUpserted = 0;

  for (const { date, balance } of [
    { date: openingAssertionDate, balance: args.openingBalance },
    { date: closingAssertionDate, balance: args.closingBalance },
  ]) {
    const existing = await ctx.db
      .query("balanceAssertions")
      .withIndex("by_account_date", (q) =>
        q.eq("accountId", accountId).eq("date", date),
      )
      .first();

    if (existing) {
      if (existing.balance !== balance && existing.source === "statement") {
        await ctx.db.patch(existing._id, { balance, source: "statement" });
        assertionsUpserted++;
      }
    } else {
      await ctx.db.insert("balanceAssertions", {
        accountId,
        date,
        balance,
        source: "statement",
      });
      assertionsUpserted++;
    }
  }

  const existingForStatement = await ctx.db
    .query("transactions")
    .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
    .collect();
  for (const row of existingForStatement) {
    await ctx.db.delete(row._id);
  }

  let transactionsUpserted = 0;
  const transactionsSkipped = 0;

  for (const txn of args.transactions) {
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_user_external_key", (q) =>
        q.eq("userId", args.userId).eq("externalKey", txn.externalKey),
      )
      .first();

    const amount = txn.credit ?? txn.debit ?? 0;
    const direction = txn.credit ? ("credit" as const) : ("debit" as const);
    const defaultType = txn.credit ? "unclassified_income" : "expense";

    if (existing) {
      // Preserve fine-grained type / category set by the user; only refresh
      // objective fields from the statement.
      await ctx.db.patch(existing._id, {
        accountId,
        date: txn.date,
        direction,
        amount,
        description: txn.narration,
        narration: txn.narration,
        source: "statement",
        statementId: args.statementId,
      });
      transactionsUpserted++;
    } else {
      await ctx.db.insert("transactions", {
        userId: args.userId,
        accountId,
        date: txn.date,
        direction,
        type: defaultType,
        amount,
        description: txn.narration,
        narration: txn.narration,
        externalKey: txn.externalKey,
        source: "statement",
        statementId: args.statementId,
      });
      transactionsUpserted++;
    }
  }

  return {
    accountId,
    assertionsUpserted,
    transactionsUpserted,
    transactionsSkipped,
  };
}

export const syncFromStatement = mutation({
  args: {
    statementId: v.id("parsedStatements"),
    bank: v.string(),
    accountFingerprint: v.string(),
    accountNumberMasked: v.string(),
    currency: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    openingBalance: v.number(),
    closingBalance: v.number(),
    transactions: v.array(
      v.object({
        date: v.string(),
        narration: v.string(),
        debit: v.optional(v.number()),
        credit: v.optional(v.number()),
        externalKey: v.string(),
      }),
    ),
  },
  returns: v.object({
    accountId: v.id("accounts"),
    assertionsUpserted: v.number(),
    transactionsUpserted: v.number(),
    transactionsSkipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const statement = await ctx.db.get(args.statementId);
    if (!statement || statement.userId !== user._id) {
      throw new Error("Statement not found");
    }
    return await syncStatementToLedger(ctx, {
      ...args,
      userId: user._id,
    });
  },
});

const unsyncedStatementValidator = v.object({
  _id: v.id("parsedStatements"),
  bank: v.string(),
  periodStart: v.string(),
  periodEnd: v.string(),
  transactionCount: v.number(),
  accountNumberMasked: v.string(),
});

export const listUnsynced = query({
  args: {},
  returns: v.array(unsyncedStatementValidator),
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    const statements = await ctx.db
      .query("parsedStatements")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const unsynced = [];
    for (const statement of statements) {
      const ledgerRow = await ctx.db
        .query("transactions")
        .withIndex("by_statement", (q) => q.eq("statementId", statement._id))
        .first();
      if (!ledgerRow) {
        unsynced.push({
          _id: statement._id,
          bank: statement.bank,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          transactionCount: statement.transactionCount,
          accountNumberMasked: statement.accountNumberMasked,
        });
      }
    }
    return unsynced;
  },
});

export const syncPendingForUser = mutation({
  args: {},
  returns: v.object({
    statementsSynced: v.number(),
    accountsTouched: v.number(),
    transactionsUpserted: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    const statements = await ctx.db
      .query("parsedStatements")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let statementsSynced = 0;
    let transactionsUpserted = 0;
    const accountsTouched = new Set<string>();

    for (const statement of statements) {
      const ledgerRow = await ctx.db
        .query("transactions")
        .withIndex("by_statement", (q) => q.eq("statementId", statement._id))
        .first();
      if (ledgerRow) continue;

      const parsedTxns = await ctx.db
        .query("parsedTransactions")
        .withIndex("by_statement", (q) => q.eq("statementId", statement._id))
        .collect();

      parsedTxns.sort((a, b) => a.sequence - b.sequence);

      const result = await syncStatementToLedger(ctx, {
        userId: user._id,
        statementId: statement._id,
        bank: statement.bank,
        accountFingerprint: statement.accountFingerprint,
        accountNumberMasked: statement.accountNumberMasked,
        currency: statement.currency,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        openingBalance: statement.openingBalance,
        closingBalance: statement.closingBalance,
        transactions: parsedTxns.map((txn) => ({
          date: txn.date,
          narration: txn.narration,
          ...(txn.debit !== undefined ? { debit: txn.debit } : {}),
          ...(txn.credit !== undefined ? { credit: txn.credit } : {}),
          externalKey: txn.externalKey,
        })),
      });

      statementsSynced++;
      transactionsUpserted += result.transactionsUpserted;
      accountsTouched.add(result.accountId);
    }

    return {
      statementsSynced,
      accountsTouched: accountsTouched.size,
      transactionsUpserted,
    };
  },
});
