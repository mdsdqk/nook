import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertMcpServerSecret } from "./mcpServerAuth";

type Ctx = QueryCtx | MutationCtx;

/**
 * Resolve the app user for an MCP access token.
 * Expiry uses Convex server time - never trust client-supplied `now`.
 */
export async function requireMcpUser(
  ctx: Ctx,
  accessTokenHash: string,
  requiredScope: "nook.read" | "nook.write" | undefined,
  serverSecret: string,
): Promise<{ user: Doc<"users">; scopes: string[] }> {
  await assertMcpServerSecret(serverSecret);

  const row = await ctx.db
    .query("mcpOauthTokens")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", accessTokenHash))
    .unique();
  // Date.now() is intentional here: auth expiry must not trust the client clock.
  const now = Date.now();
  if (!row || row.expiresAt < now) {
    throw new Error("Unauthorized");
  }
  if (requiredScope && !row.scopes.includes(requiredScope)) {
    throw new Error(`Missing required scope: ${requiredScope}`);
  }
  const user = await ctx.db.get(row.userId);
  if (!user) {
    throw new Error("User not found");
  }
  return { user, scopes: row.scopes };
}
