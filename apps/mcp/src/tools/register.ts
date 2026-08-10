import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBytes, parseBytes, parseWealthBytes } from "@nook/pipeline";
import {
  ConvexStatementWriter,
  toKuveraConvexPayload,
} from "@nook/persistence";
import type { ConvexWritePayload } from "@nook/persistence";
import { api } from "@nook/convex/_generated/api";
import type { AuthUser } from "../lib/convex";
import {
  getConvex,
  upsertKuvera,
  upsertStatementAndSync,
} from "../lib/convex";
import { errorResult, loadFileBytes, textResult } from "../lib/files";
import { requireScope } from "../lib/scopes";

const fileInput = {
  filename: z.string().describe("Original filename including extension"),
  fileBase64: z
    .string()
    .optional()
    .describe("Base64-encoded file contents"),
  fileUrl: z
    .string()
    .url()
    .optional()
    .describe("HTTPS URL to download the file (private hosts blocked)"),
};

function requireFileSource(args: {
  fileBase64?: string;
  fileUrl?: string;
}) {
  if (!args.fileBase64 && !args.fileUrl) {
    throw new Error("Either fileBase64 or fileUrl is required");
  }
}

function mcpAuth(user: AuthUser) {
  return { accessTokenHash: user.tokenHash, now: Date.now() };
}

export function registerTools(
  server: McpServer,
  getUser: () => AuthUser,
): void {
  server.tool(
    "detect_statement",
    "Detect bank / account type / format version from a statement PDF (no write).",
    fileInput,
    async (args) => {
      try {
        requireScope(getUser(), "nook.read");
        requireFileSource(args);
        const { bytes } = await loadFileBytes(args);
        const detection = await detectBytes(bytes);
        return textResult({ detection });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "parse_statement",
    "Parse a bank statement PDF, always upsert to Convex, and sync to the ledger. Returns a summary.",
    fileInput,
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.write");
        requireFileSource(args);
        const { bytes, filename } = await loadFileBytes(args);
        const result = await parseBytes(bytes, filename);

        if (!result.statement) {
          return errorResult(
            `Parse failed: ${result.errors.map((e) => e.message).join("; ") || "no statement"}`,
          );
        }

        if (!result.validation?.passed) {
          return errorResult(
            `Validation failed; not persisted. ${result.errors.map((e) => e.message).join("; ")}`,
          );
        }

        let payload: ConvexWritePayload | null = null;
        const writer = new ConvexStatementWriter(async (p) => {
          payload = p;
        });
        await writer.write(result);
        if (!payload) {
          return errorResult("Failed to build Convex payload");
        }

        const { stmtResult, syncResult } = await upsertStatementAndSync(
          user.tokenHash,
          payload,
          true,
        );

        return textResult({
          detection: result.detection,
          period: result.statement.metadata.statementPeriod,
          openingBalance: result.statement.openingBalance,
          closingBalance: result.statement.closingBalance,
          transactionCount: result.statement.transactions.length,
          validationPassed: true,
          persist: stmtResult,
          ledgerSync: syncResult,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "parse_wealth_kuvera",
    "Parse a Kuvera capital-gains XLSX and always upsert into Convex wealth tables.",
    fileInput,
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.write");
        requireFileSource(args);
        const { bytes, filename } = await loadFileBytes(args);
        const result = await parseWealthBytes(bytes, filename);
        if (!result.wealthStatement) {
          return errorResult(
            `Parse failed: ${result.errors.map((e) => e.message).join("; ") || "no wealth statement"}`,
          );
        }

        const payload = toKuveraConvexPayload(result);
        const upsert = await upsertKuvera(user.tokenHash, payload);
        const lotCount = result.wealthStatement.schemes.reduce(
          (n, s) => n + s.lots.length,
          0,
        );

        return textResult({
          detection: result.detection,
          period: result.wealthStatement.period,
          schemeCount: result.wealthStatement.schemes.length,
          lotCount,
          persist: upsert,
          note: "Capital-gains lots are closed FIFO pairs; open holdings may be zero after import",
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_accounts",
    "List money accounts with balances as of a date (YYYY-MM-DD).",
    {
      asOfDate: z
        .string()
        .describe("Balance as-of date YYYY-MM-DD")
        .optional(),
    },
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const asOfDate =
          args.asOfDate ?? new Date().toISOString().slice(0, 10);
        const accounts = await getConvex().query(api.mcpApi.listAccounts, {
          ...mcpAuth(user),
          asOfDate,
        });
        return textResult({ asOfDate, accounts });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_transactions",
    "List ledger transactions for the authenticated user (optional account filter). Caps at limit.",
    {
      accountId: z.string().optional(),
      direction: z.enum(["credit", "debit"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const rows = await getConvex().query(api.mcpApi.listTransactions, {
          ...mcpAuth(user),
          ...(args.accountId
            ? { accountId: args.accountId as never }
            : {}),
          ...(args.direction ? { direction: args.direction } : {}),
        });
        const limit = args.limit ?? 50;
        return textResult({
          total: rows.length,
          returned: Math.min(limit, rows.length),
          transactions: rows.slice(0, limit),
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_statements",
    "List parsed bank statements stored for the user.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const statements = await getConvex().query(api.mcpApi.listStatements, {
          ...mcpAuth(user),
        });
        return textResult({ statements });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_unsynced",
    "List parsed statements that have not been promoted to the ledger yet.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const statements = await getConvex().query(api.mcpApi.listUnsynced, {
          ...mcpAuth(user),
        });
        return textResult({ statements });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "sync_ledger",
    "Sync all pending parsed statements into the ledger for the user.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.write");
        const result = await getConvex().mutation(api.mcpApi.syncPending, {
          ...mcpAuth(user),
        });
        return textResult(result);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "sync_transfers",
    "Match and link cross-account transfer pairs for the user.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.write");
        const result = await getConvex().mutation(api.mcpApi.syncTransfers, {
          ...mcpAuth(user),
        });
        return textResult({
          pairCount: result.pairs.length,
          pairs: result.pairs,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "cashflow_timeline",
    "Monthly net cashflow timeline for the authenticated user.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const timeline = await getConvex().query(api.mcpApi.cashflowTimeline, {
          ...mcpAuth(user),
          granularity: "monthly",
        });
        return textResult({ timeline });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_instruments",
    "List wealth instruments for the user.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const instruments = await getConvex().query(api.mcpApi.listInstruments, {
          ...mcpAuth(user),
        });
        return textResult({ instruments });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_holdings",
    "List wealth holdings for the user.",
    async () => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const holdings = await getConvex().query(api.mcpApi.listHoldings, {
          ...mcpAuth(user),
        });
        return textResult({ holdings });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "get_portfolio",
    "Get portfolio summary (investments + liquid cash) as of a date.",
    {
      asOfDate: z.string().optional().describe("YYYY-MM-DD"),
    },
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.read");
        const asOfDate =
          args.asOfDate ?? new Date().toISOString().slice(0, 10);
        const portfolio = await getConvex().query(api.mcpApi.getPortfolio, {
          ...mcpAuth(user),
          asOfDate,
        });
        return textResult({ asOfDate, portfolio });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "create_manual_instrument",
    "Create a manual mutual-fund instrument in wealth.",
    {
      name: z.string(),
      currency: z.string().default("INR"),
      fundHouse: z.string(),
      schemeName: z.string(),
      plan: z.enum(["direct", "regular"]),
      option: z.enum(["growth", "idcw"]),
      provider: z.string().optional(),
      schemeCode: z.string().optional(),
      isin: z.string().optional(),
      category: z.string().optional(),
      note: z.string().optional(),
    },
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.write");
        const instrumentId = await getConvex().mutation(
          api.mcpApi.createManualInstrument,
          {
            ...mcpAuth(user),
            name: args.name,
            currency: args.currency,
            fundHouse: args.fundHouse,
            schemeName: args.schemeName,
            plan: args.plan,
            option: args.option,
            ...(args.provider ? { provider: args.provider } : {}),
            ...(args.schemeCode ? { schemeCode: args.schemeCode } : {}),
            ...(args.isin ? { isin: args.isin } : {}),
            ...(args.category ? { category: args.category } : {}),
            ...(args.note ? { note: args.note } : {}),
          },
        );
        return textResult({ instrumentId });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "record_manual_asset_transaction",
    "Record a manual asset transaction (buy/sell/etc.) and recompute holdings.",
    {
      instrumentId: z.string(),
      containerId: z.string().describe("Folio or container id"),
      type: z.string().describe("Asset transaction type e.g. buy, sell"),
      date: z.string().describe("YYYY-MM-DD"),
      quantity: z.number().optional(),
      price: z.number().optional(),
      amount: z.number().optional(),
      executionType: z.string().optional(),
      note: z.string().optional(),
    },
    async (args) => {
      try {
        const user = getUser();
        requireScope(user, "nook.write");
        const result = await getConvex().mutation(
          api.mcpApi.recordManualAssetTransaction,
          {
            ...mcpAuth(user),
            instrumentId: args.instrumentId as never,
            containerId: args.containerId,
            type: args.type,
            date: args.date,
            ...(args.quantity !== undefined ? { quantity: args.quantity } : {}),
            ...(args.price !== undefined ? { price: args.price } : {}),
            ...(args.amount !== undefined ? { amount: args.amount } : {}),
            ...(args.executionType
              ? { executionType: args.executionType }
              : {}),
            ...(args.note ? { note: args.note } : {}),
          },
        );
        return textResult(result);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
