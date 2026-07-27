import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const syncFromStatement = mutation({
  args: {
    userId: v.id("users"),
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
    // 1. Resolve or create account
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
        type: "asset.bank",
        institution: args.bank,
        accountFingerprint: args.accountFingerprint,
        accountNumberMasked: args.accountNumberMasked,
        currency: args.currency,
      });
      account = (await ctx.db.get(accountId))!;
    }

    const accountId = account._id;

    // 2. Upsert balance assertions.
    // Opening is asserted on the day before the statement period start so
    // same-day transactions remain part of the explanatory interval.
    // Closing is asserted at the later of periodEnd and max txn date to avoid
    // double-counting entries posted after periodEnd but already included in
    // statement closing balance.
    const maxTxnDate =
      args.transactions.length > 0
        ? args.transactions
            .map((t) => t.date)
            .sort((a, b) => a.localeCompare(b))
            .at(-1) ?? args.periodEnd
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
        // Never overwrite user-authored assertions. Only update statement-sourced rows.
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

    // 3. Refresh statement-linked ledger rows, then upsert by user+externalKey.
    const existingForStatement = await ctx.db
      .query("transactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .collect();
    for (const row of existingForStatement) {
      await ctx.db.delete(row._id);
    }

    let transactionsUpserted = 0;
    let transactionsSkipped = 0;

    for (const txn of args.transactions) {
      const existing = await ctx.db
        .query("transactions")
        .withIndex("by_user_external_key", (q) =>
          q.eq("userId", args.userId).eq("externalKey", txn.externalKey),
        )
        .first();

      if (existing) {
        const amount = txn.credit ?? txn.debit ?? 0;
        const type = txn.credit ? "income" : "expense";
        await ctx.db.patch(existing._id, {
          accountId,
          date: txn.date,
          type,
          amount,
          description: txn.narration,
          narration: txn.narration,
          source: "statement",
          statementId: args.statementId,
        });
        transactionsUpserted++;
      } else {
        const amount = txn.credit ?? txn.debit ?? 0;
        const type = txn.credit ? "income" : "expense";

        await ctx.db.insert("transactions", {
          userId: args.userId,
          accountId,
          date: txn.date,
          type,
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
  },
});

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const utcMs = Date.UTC(year, month - 1, day + deltaDays);
  return new Date(utcMs).toISOString().slice(0, 10);
}
