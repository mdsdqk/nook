import { isCashflowIn, isSpending, isTransactionType } from "@nook/domain";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAppUser } from "./lib/auth";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const cashflowTimeline = query({
  args: {
    granularity: v.literal("monthly"),
  },
  returns: v.array(
    v.object({
      month: v.string(),
      net: v.number(),
      key: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const buckets = new Map<string, number>();

    for (const txn of txns) {
      if (!isTransactionType(txn.type)) continue;
      if (!isSpending(txn.type) && !isCashflowIn(txn.type)) continue;
      const key = txn.date.slice(0, 7); // YYYY-MM
      const direction =
        txn.direction ??
        (isCashflowIn(txn.type) ? ("credit" as const) : ("debit" as const));
      const delta = direction === "credit" ? txn.amount : -txn.amount;
      buckets.set(key, (buckets.get(key) ?? 0) + delta);
    }

    // granularity reserved for future weekly/daily buckets
    void args.granularity;

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, net]) => {
        const monthIndex = Number(key.slice(5, 7)) - 1;
        const month = MONTH_LABELS[monthIndex] ?? key;
        return { key, month, net };
      });
  },
});
