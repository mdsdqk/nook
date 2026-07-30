import {
  computeAccountBalance,
  type LedgerTransaction,
  type TransactionType,
} from "@nook/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function computeBalancesForUser(
  ctx: Ctx,
  userId: Id<"users">,
  asOfDate: string,
): Promise<Map<Id<"accounts">, number>> {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const txns = await ctx.db
    .query("transactions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const ledgerTxns: LedgerTransaction[] = txns.map((t) => ({
    accountId: t.accountId,
    amount: t.amount,
    date: t.date,
    type: t.type as TransactionType,
  }));

  const balances = new Map<Id<"accounts">, number>();

  for (const account of accounts) {
    const assertions = await ctx.db
      .query("balanceAssertions")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();

    const balance = computeAccountBalance(
      assertions.map((a) => ({
        accountId: a.accountId,
        date: a.date,
        balance: a.balance,
      })),
      ledgerTxns,
      account._id,
      asOfDate,
    );
    balances.set(account._id, balance);
  }

  return balances;
}

export async function upsertManualAssertion(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  date: string,
  balance: number,
): Promise<void> {
  const existing = await ctx.db
    .query("balanceAssertions")
    .withIndex("by_account_date", (q) =>
      q.eq("accountId", accountId).eq("date", date),
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { balance, source: "manual" });
  } else {
    await ctx.db.insert("balanceAssertions", {
      accountId,
      date,
      balance,
      source: "manual",
    });
  }
}
