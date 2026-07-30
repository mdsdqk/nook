import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

type Direction = "credit" | "debit";

type LegacyTxn = Doc<"transactions"> & {
  direction?: Direction;
};

/**
 * One-shot migration: old coarse types → direction + fine-grained type.
 *
 * Mapping:
 * - income → credit + unclassified_income (drop category "Income")
 * - expense → debit + expense
 * - transfer + role in → credit + internal_transfer (clear "Transfer" category)
 * - transfer + role out/missing → debit + internal_transfer
 * - obligation → debit + emi_payment
 *
 * Run via CLI (internal only):
 * `bunx convex run migrations:migrateTransactionClassification`
 */
export const migrateTransactionClassification = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    const rows = (await ctx.db.query("transactions").collect()) as LegacyTxn[];
    let patched = 0;
    let skipped = 0;

    for (const row of rows) {
      const next = migrateRow(row);
      if (!next) {
        skipped++;
        continue;
      }

      const {
        _id: _ignoredId,
        _creationTime: _ignoredCreation,
        ...rest
      } = row;

      const replaced: Omit<Doc<"transactions">, "_id" | "_creationTime"> = {
        ...rest,
        direction: next.direction,
        type: next.type,
        ...(next.clearCategory
          ? {}
          : row.category !== undefined
            ? { category: row.category }
            : {}),
      };

      if (next.clearCategory) {
        delete (replaced as { category?: string }).category;
      }

      await ctx.db.replace(row._id, replaced);
      patched++;
    }

    return { scanned: rows.length, patched, skipped };
  },
});

function migrateRow(row: LegacyTxn): {
  direction: Direction;
  type: string;
  clearCategory: boolean;
} | null {
  if (row.direction !== undefined && !isLegacyType(row.type)) {
    return null;
  }

  switch (row.type) {
    case "income":
      return {
        direction: "credit",
        type: "unclassified_income",
        clearCategory: row.category === "Income",
      };
    case "expense":
      if (row.direction !== undefined) return null;
      return {
        direction: "debit",
        type: "expense",
        clearCategory: false,
      };
    case "transfer":
      return {
        direction: row.transferRole === "in" ? "credit" : "debit",
        type: "internal_transfer",
        clearCategory: row.category === "Transfer",
      };
    case "obligation":
      return {
        direction: "debit",
        type: "emi_payment",
        clearCategory: false,
      };
    default: {
      if (row.direction !== undefined) return null;
      return {
        direction: inferDirectionFromType(row.type, row.transferRole),
        type: row.type,
        clearCategory: false,
      };
    }
  }
}

function isLegacyType(type: string): boolean {
  return (
    type === "income" ||
    type === "expense" ||
    type === "transfer" ||
    type === "obligation"
  );
}

function inferDirectionFromType(
  type: string,
  transferRole: "out" | "in" | undefined,
): Direction {
  if (transferRole === "in") return "credit";
  if (transferRole === "out") return "debit";
  if (
    type === "unclassified_income" ||
    type === "salary" ||
    type === "interest" ||
    type === "dividend" ||
    type === "rental_income" ||
    type === "business_income" ||
    type === "capital_gain" ||
    type === "gift" ||
    type === "cashback" ||
    type === "tax_refund" ||
    type === "loan_disbursement" ||
    type === "investment_redemption" ||
    type === "insurance_claim" ||
    type === "friend_repayment" ||
    type === "shared_expense_repayment"
  ) {
    return "credit";
  }
  return "debit";
}
