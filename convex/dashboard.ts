import { v } from "convex/values";
import { query } from "./_generated/server";

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
    userId: v.id("users"),
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
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const buckets = new Map<string, number>();

    for (const txn of txns) {
      if (txn.type !== "income" && txn.type !== "expense") continue;
      const key = txn.date.slice(0, 7); // YYYY-MM
      const delta = txn.type === "income" ? txn.amount : -txn.amount;
      buckets.set(key, (buckets.get(key) ?? 0) + delta);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, net]) => {
        const monthIndex = Number(key.slice(5, 7)) - 1;
        const month = MONTH_LABELS[monthIndex] ?? key;
        return { key, month, net };
      });
  },
});
