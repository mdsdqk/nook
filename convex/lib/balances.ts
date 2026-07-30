import {
  computeAccountBalance,
  type LedgerTransaction,
  type TransactionType,
} from "@nook/domain";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Map ledger docs to domain transactions, collapsing linked transfer pairs
 * into a single dual-account transfer so balances stay net-worth neutral.
 *
 * Fail closed: only collapse when amounts match. Broken / mismatched / orphaned
 * transfer legs fall back to expense (out) or income (in) so balances stay correct.
 */
export function toLedgerTransactions(
  txns: Doc<"transactions">[],
): LedgerTransaction[] {
  const byId = new Map(txns.map((txn) => [txn._id, txn]));
  const skip = new Set<string>();
  const ledger: LedgerTransaction[] = [];

  for (const txn of txns) {
    if (skip.has(txn._id)) continue;

    if (
      txn.type === "transfer" &&
      txn.linkedTransactionId !== undefined &&
      txn.transferRole !== undefined
    ) {
      const counterpart = byId.get(txn.linkedTransactionId);
      if (
        counterpart &&
        counterpart.type === "transfer" &&
        counterpart.linkedTransactionId === txn._id &&
        counterpart.transferRole !== undefined &&
        counterpart.transferRole !== txn.transferRole &&
        counterpart.amount === txn.amount
      ) {
        const out = txn.transferRole === "out" ? txn : counterpart;
        const inn = txn.transferRole === "in" ? txn : counterpart;
        skip.add(out._id);
        skip.add(inn._id);
        ledger.push({
          accountId: out.accountId,
          toAccountId: inn.accountId,
          amount: out.amount,
          date: out.date,
          type: "transfer",
        });
        continue;
      }
    }

    ledger.push(fallbackLedgerTxn(txn));
  }

  return ledger;
}

/** Map a non-collapsed transfer leg by role so in-legs never subtract. */
function fallbackLedgerTxn(txn: Doc<"transactions">): LedgerTransaction {
  if (txn.type === "transfer") {
    if (txn.transferRole === "in") {
      return {
        accountId: txn.accountId,
        amount: txn.amount,
        date: txn.date,
        type: "income",
      };
    }
    if (txn.transferRole === "out") {
      return {
        accountId: txn.accountId,
        amount: txn.amount,
        date: txn.date,
        type: "expense",
      };
    }
  }
  return {
    accountId: txn.accountId,
    amount: txn.amount,
    date: txn.date,
    type: txn.type as TransactionType,
  };
}

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

  const ledgerTxns = toLedgerTransactions(txns);

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
