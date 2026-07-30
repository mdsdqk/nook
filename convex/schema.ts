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
    direction: v.union(v.literal("credit"), v.literal("debit")),
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
    linkedTransactionId: v.optional(v.id("transactions")),
    transferRole: v.optional(v.union(v.literal("out"), v.literal("in"))),
  })
    .index("by_account", ["accountId"])
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_external_key", ["externalKey"])
    .index("by_statement", ["statementId"])
    .index("by_user_external_key", ["userId", "externalKey"])
    .index("by_linked", ["linkedTransactionId"]),

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

  // --- Wealth domain ---
  // Instruments are TEMPORARILY user-scoped for manual entry convenience.
  // Long-term: shared Instrument Catalog; users own Holdings, not Instruments.
  instruments: defineTable({
    userId: v.id("users"),
    assetClass: v.literal("mutual_fund"),
    name: v.string(),
    currency: v.string(),
    provider: v.optional(v.string()),
    fundHouse: v.string(),
    schemeName: v.string(),
    schemeCode: v.optional(v.string()),
    isin: v.optional(v.string()),
    plan: v.union(v.literal("direct"), v.literal("regular")),
    option: v.union(v.literal("growth"), v.literal("idcw")),
    category: v.optional(v.string()),
    externalKey: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_class", ["userId", "assetClass"])
    .index("by_external_key", ["userId", "externalKey"]),

  // Thin provenance only — no payload blob. Evidence never updates Holdings.
  wealthEvidence: defineTable({
    userId: v.id("users"),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("cas"),
      v.literal("broker_statement"),
      v.literal("broker_api"),
    ),
    documentId: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_source", ["userId", "sourceType"]),

  assetTransactions: defineTable({
    userId: v.id("users"),
    instrumentId: v.id("instruments"),
    containerId: v.string(),
    type: v.string(),
    executionType: v.optional(v.string()),
    date: v.string(),
    quantity: v.optional(v.number()),
    price: v.optional(v.number()),
    amount: v.optional(v.number()),
    evidenceId: v.id("wealthEvidence"),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("cas"),
      v.literal("broker_statement"),
      v.literal("broker_api"),
    ),
    bankTransactionId: v.optional(v.id("transactions")),
    externalKey: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_instrument", ["instrumentId"])
    .index("by_holding_key", ["userId", "instrumentId", "containerId"])
    .index("by_evidence", ["evidenceId"])
    .index("by_owner_instrument_external_key", [
      "userId",
      "instrumentId",
      "externalKey",
    ]),

  // Materialized derived state. Never patch from clients — recompute only.
  // lastPrice/currentValue are provisional (last known price; price discovery OOS).
  holdings: defineTable({
    userId: v.id("users"),
    instrumentId: v.id("instruments"),
    containerId: v.string(),
    quantity: v.number(),
    investedAmount: v.number(),
    currentValue: v.number(),
    costBasis: v.number(),
    unrealizedGain: v.number(),
    unrealizedGainPercent: v.number(),
    lastUpdated: v.string(),
    lastPrice: v.optional(v.number()),
    costBasisStrategy: v.literal("average"),
    realizedGain: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_instrument", ["userId", "instrumentId"])
    .index("by_holding_key", ["userId", "instrumentId", "containerId"]),
});
