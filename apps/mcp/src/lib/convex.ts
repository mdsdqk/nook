import { ConvexHttpClient } from "convex/browser";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";
import type { ConvexWritePayload } from "@nook/persistence";
import type { KuveraConvexWritePayload } from "@nook/persistence";
import { config } from "./config";

let client: ConvexHttpClient | null = null;

export function getConvex(): ConvexHttpClient {
  if (!client) {
    client = new ConvexHttpClient(config.convexUrl());
  }
  return client;
}

export type AuthUser = {
  userId: Id<"users">;
  scopes: string[];
};

export async function resolveBearerToken(
  authorization: string | null,
): Promise<AuthUser | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const { sha256Hex } = await import("./crypto");
  const tokenHash = sha256Hex(token);
  const row = await getConvex().query(api.mcpOauth.resolveAccessToken, {
    tokenHash,
    now: Date.now(),
  });
  if (!row) return null;
  return { userId: row.userId, scopes: row.scopes };
}

export async function upsertStatementAndSync(
  userId: Id<"users">,
  payload: ConvexWritePayload,
  syncLedger: boolean,
) {
  const c = getConvex();
  const stmtResult = await c.mutation(api.statements.upsertStatement, {
    userId,
    bank: payload.bank,
    accountFingerprint: payload.accountFingerprint,
    accountNumberMasked: payload.accountNumberMasked,
    currency: payload.currency,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    openingBalance: payload.openingBalance,
    closingBalance: payload.closingBalance,
    transactionCount: payload.transactionCount,
    contentHash: payload.contentHash,
    ...(payload.sourcePath ? { sourcePath: payload.sourcePath } : {}),
    transactions: payload.transactions.map((t) => ({
      sequence: t.sequence,
      date: t.date,
      narration: t.narration,
      ...(t.debit !== undefined ? { debit: t.debit } : {}),
      ...(t.credit !== undefined ? { credit: t.credit } : {}),
      balance: t.balance,
      reference: t.reference,
      externalKey: t.externalKey,
    })),
  });

  let syncResult: {
    accountId: string;
    assertionsUpserted: number;
    transactionsUpserted: number;
    transactionsSkipped: number;
  } | null = null;

  if (syncLedger) {
    syncResult = await c.mutation(api.ledgerSync.syncFromStatement, {
      userId,
      statementId: stmtResult.statementId,
      bank: payload.bank,
      accountFingerprint: payload.accountFingerprint,
      accountNumberMasked: payload.accountNumberMasked,
      currency: payload.currency,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      openingBalance: payload.openingBalance,
      closingBalance: payload.closingBalance,
      transactions: payload.transactions.map((t) => ({
        date: t.date,
        narration: t.narration,
        ...(t.debit !== undefined ? { debit: t.debit } : {}),
        ...(t.credit !== undefined ? { credit: t.credit } : {}),
        externalKey: t.externalKey,
      })),
    });
  }

  return { stmtResult, syncResult };
}

export async function upsertKuvera(
  userId: Id<"users">,
  payload: KuveraConvexWritePayload,
) {
  return await getConvex().mutation(api.wealth.upsertKuveraCapitalGains, {
    userId,
    contentHash: payload.contentHash,
    ...(payload.sourcePath ? { sourcePath: payload.sourcePath } : {}),
    periodLabel: payload.periodLabel,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    schemes: payload.schemes,
  });
}
