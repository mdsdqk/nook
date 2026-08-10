import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function requireMcpUser(
  ctx: Ctx,
  accessTokenHash: string,
  now: number,
  requiredScope?: "nook.read" | "nook.write",
): Promise<{ user: Doc<"users">; scopes: string[] }> {
  const row = await ctx.db
    .query("mcpOauthTokens")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", accessTokenHash))
    .unique();
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
