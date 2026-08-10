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
  tokenHash: string;
  scopes: string[];
};

/**
 * Resolve app user from a Better Auth session token (same mechanism as CLI auth).
 * Exchanges session → Convex JWT, then calls users.me / ensureCurrentUser.
 */
export async function resolveUserFromBetterAuthSession(
  sessionToken: string,
): Promise<Id<"users"> | null> {
  const tokenRes = await fetch(
    `${config.convexSiteUrl()}/api/auth/convex/token`,
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
    },
  );
  if (!tokenRes.ok) return null;
  const data = (await tokenRes.json()) as { token?: string };
  if (!data.token) return null;

  const authed = new ConvexHttpClient(config.convexUrl());
  authed.setAuth(data.token);
  await authed.mutation(api.users.ensureCurrentUser, {});
  const me = await authed.query(api.users.me, {});
  return me?._id ?? null;
}

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
  return { userId: row.userId, tokenHash, scopes: row.scopes };
}

export async function upsertStatementAndSync(
  tokenHash: string,
  payload: ConvexWritePayload,
  syncLedger: boolean,
) {
  const result = await getConvex().mutation(api.mcpApi.upsertStatementAndSync, {
    accessTokenHash: tokenHash,
    now: Date.now(),
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
    syncLedger,
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

  return {
    stmtResult: {
      statementId: result.statementId,
      action: result.action,
    },
    syncResult: result.syncResult,
  };
}

export async function upsertKuvera(
  tokenHash: string,
  payload: KuveraConvexWritePayload,
) {
  return await getConvex().mutation(api.mcpApi.upsertKuvera, {
    accessTokenHash: tokenHash,
    now: Date.now(),
    contentHash: payload.contentHash,
    ...(payload.sourcePath ? { sourcePath: payload.sourcePath } : {}),
    periodLabel: payload.periodLabel,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    schemes: payload.schemes,
  });
}
