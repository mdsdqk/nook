import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    name: v.string(),
  }).index("by_username", ["username"]),

  accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.string(),
    institution: v.optional(v.string()),
    accountFingerprint: v.optional(v.string()),
    accountNumberMasked: v.optional(v.string()),
    currency: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_fingerprint", ["userId", "institution", "accountFingerprint"]),

  balanceAssertions: defineTable({
    accountId: v.id("accounts"),
    date: v.string(),
    balance: v.number(),
    source: v.optional(v.string()),
  })
    .index("by_account", ["accountId"])
    .index("by_account_date", ["accountId", "date"]),

  transactions: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    date: v.string(),
    type: v.string(),
    amount: v.number(),
    description: v.optional(v.string()),
    narration: v.optional(v.string()),
    merchant: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    externalKey: v.optional(v.string()),
    source: v.optional(v.string()),
    statementId: v.optional(v.id("parsedStatements")),
  })
    .index("by_account", ["accountId"])
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_external_key", ["externalKey"])
    .index("by_statement", ["statementId"])
    .index("by_user_external_key", ["userId", "externalKey"]),

  parsedStatements: defineTable({
    userId: v.id("users"),
    bank: v.string(),
    accountFingerprint: v.string(),
    accountNumberMasked: v.string(),
    currency: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    openingBalance: v.number(),
    closingBalance: v.number(),
    transactionCount: v.number(),
    contentHash: v.string(),
    sourcePath: v.optional(v.string()),
    status: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_dedupe", [
      "userId",
      "bank",
      "accountFingerprint",
      "periodStart",
      "periodEnd",
    ])
    .index("by_content_hash", ["userId", "contentHash"]),

  parsedTransactions: defineTable({
    statementId: v.id("parsedStatements"),
    sequence: v.number(),
    date: v.string(),
    narration: v.string(),
    debit: v.optional(v.number()),
    credit: v.optional(v.number()),
    balance: v.number(),
    reference: v.string(),
    externalKey: v.string(),
  })
    .index("by_statement", ["statementId"])
    .index("by_external_key", ["externalKey"]),
});
