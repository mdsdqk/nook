import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authSubject: v.string(),
    email: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    image: v.optional(v.string()),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_email", ["email"])
    .index("by_username", ["username"]),

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
    /** False when parse validation failed; excluded from ledger sync queues. */
    validationPassed: v.optional(v.boolean()),
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

  /** Short-lived ownership claim for uploaded statement PDFs. */
  statementUploads: defineTable({
    storageId: v.id("_storage"),
    userId: v.id("users"),
    filename: v.string(),
    byteSize: v.number(),
    createdAt: v.number(),
  })
    .index("by_storage", ["storageId"])
    .index("by_user", ["userId"])
    .index("by_created", ["createdAt"]),

  /**
   * Per-username import policy overrides (allowlist).
   * Absent username → DEFAULT_IMPORT_POLICY.
   */
  importLimitOverrides: defineTable({
    username: v.string(),
    maxImportsPerHour: v.number(),
    maxFilesPerBatch: v.number(),
    maxBytesPerFile: v.number(),
    maxBytesPerBatch: v.number(),
    notes: v.optional(v.string()),
  }).index("by_username", ["username"]),

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

  // Thin provenance only - no payload blob. Evidence never updates Holdings.
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

  // Materialized derived state. Never patch from clients - recompute only.
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

  // Idempotent wealth import envelope (analogous to parsedStatements).
  wealthDocuments: defineTable({
    userId: v.id("users"),
    provider: v.literal("kuvera"),
    statementType: v.literal("capital_gains"),
    periodLabel: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    contentHash: v.string(),
    sourcePath: v.optional(v.string()),
    status: v.string(),
    schemeCount: v.number(),
    lotCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_content_hash", ["userId", "contentHash"])
    .index("by_dedupe", ["userId", "provider", "statementType", "contentHash"]),

  // --- MCP OAuth 2.1 (shared by apps/mcp + Spiky consent UI) ---
  mcpOauthClients: defineTable({
    clientId: v.string(),
    clientSecretHash: v.optional(v.string()),
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    grantTypes: v.array(v.string()),
    tokenEndpointAuthMethod: v.string(),
    createdAt: v.number(),
  }).index("by_client_id", ["clientId"]),

  mcpOauthCodes: defineTable({
    codeHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    codeChallengeMethod: v.string(),
    resource: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_code_hash", ["codeHash"]),

  mcpOauthTokens: defineTable({
    tokenHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    scopes: v.array(v.string()),
    resource: v.optional(v.string()),
    expiresAt: v.number(),
    refreshTokenHash: v.optional(v.string()),
    refreshExpiresAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_refresh_hash", ["refreshTokenHash"]),
});
