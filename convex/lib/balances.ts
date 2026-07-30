import {
  computeAccountBalance,
  type LedgerTransaction,
  type TransactionType,
  isTransactionType,
} from "@nook/domain";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

function isInternalTransfer(type: string): boolean {
  return type === "internal_transfer" || type === "transfer";
}

/**
 * Map ledger docs to domain transactions, collapsing linked transfer pairs
 * into a single dual-account transfer so balances stay net-worth neutral.
 *
 * Fail closed: only collapse when amounts match. Broken / mismatched / orphaned
 * transfer legs fall back to direction-based signed amounts.
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
      isInternalTransfer(txn.type) &&
      txn.linkedTransactionId !== undefined &&
      txn.transferRole !== undefined
    ) {
      const counterpart = byId.get(txn.linkedTransactionId);
      if (
        counterpart &&
        isInternalTransfer(counterpart.type) &&
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
          direction: "debit",
          type: "internal_transfer",
        });
        continue;
      }
    }

    ledger.push(fallbackLedgerTxn(txn));
  }

  return ledger;
}

/** Map a non-collapsed transfer leg by role/direction so in-legs never subtract. */
function fallbackLedgerTxn(txn: Doc<"transactions">): LedgerTransaction {
  const direction = resolveDirection(txn);

  if (isInternalTransfer(txn.type)) {
    if (txn.transferRole === "in" || direction === "credit") {
      return {
        accountId: txn.accountId,
        amount: txn.amount,
        date: txn.date,
        direction: "credit",
        type: "unclassified_income",
      };
    }
    return {
      accountId: txn.accountId,
      amount: txn.amount,
      date: txn.date,
      direction: "debit",
      type: "expense",
    };
  }

  const type: TransactionType = isTransactionType(txn.type)
    ? txn.type
    : direction === "credit"
      ? "unclassified_income"
      : "expense";

  return {
    accountId: txn.accountId,
    amount: txn.amount,
    date: txn.date,
    direction,
    type,
  };
}

function resolveDirection(
  txn: Doc<"transactions">,
): "credit" | "debit" {
  if (txn.direction === "credit" || txn.direction === "debit") {
    return txn.direction;
  }
  if (txn.transferRole === "in") return "credit";
  if (txn.transferRole === "out") return "debit";
  if (
    txn.type === "income" ||
    txn.type === "unclassified_income" ||
    txn.type === "salary" ||
    txn.type === "interest" ||
    txn.type === "dividend" ||
    txn.type === "rental_income" ||
    txn.type === "business_income" ||
    txn.type === "capital_gain" ||
    txn.type === "gift" ||
    txn.type === "cashback" ||
    txn.type === "tax_refund" ||
    txn.type === "loan_disbursement" ||
    txn.type === "investment_redemption" ||
    txn.type === "insurance_claim" ||
    txn.type === "friend_repayment" ||
    txn.type === "shared_expense_repayment"
  ) {
    return "credit";
  }
  return "debit";
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
