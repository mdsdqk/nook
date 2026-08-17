import {
  RateLimiter,
  HOUR,
  type RateLimitConfig,
} from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  DEFAULT_IMPORT_POLICY,
  importHourlyLimitConfig,
  resolveImportPolicy,
  type ImportPolicy,
} from "./lib/importPolicy";

/** Unnamed limits - always pass inline `config` so overrides apply. */
export const importRateLimiter = new RateLimiter(components.rateLimiter);

export async function getImportPolicyForUser(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<ImportPolicy> {
  const username = user.username?.trim().toLowerCase();
  if (!username) {
    return { ...DEFAULT_IMPORT_POLICY };
  }
  const override = await ctx.db
    .query("importLimitOverrides")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();
  return resolveImportPolicy(override);
}

export async function consumeStatementImportQuota(
  ctx: MutationCtx,
  user: Doc<"users">,
  count = 1,
): Promise<void> {
  const policy = await getImportPolicyForUser(ctx, user);
  const config: RateLimitConfig = importHourlyLimitConfig(policy);
  const result = await importRateLimiter.limit(ctx, "statementImport", {
    key: user._id,
    count,
    config,
  });
  if (!result.ok) {
    const seconds = Math.ceil((result.retryAfter ?? HOUR) / 1000);
    throw new Error(
      `Import rate limit exceeded (${policy.maxImportsPerHour}/hour). Retry in ~${seconds}s.`,
    );
  }
}

export async function consumeCliUpsertQuota(
  ctx: MutationCtx,
  userId: Id<"users">,
  username: string | undefined,
): Promise<void> {
  let policy: ImportPolicy = { ...DEFAULT_IMPORT_POLICY };
  const normalized = username?.trim().toLowerCase();
  if (normalized) {
    const override = await ctx.db
      .query("importLimitOverrides")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();
    policy = resolveImportPolicy(override);
  }
  const config: RateLimitConfig = importHourlyLimitConfig(policy);
  const result = await importRateLimiter.limit(ctx, "statementUpsertCli", {
    key: userId,
    config,
  });
  if (!result.ok) {
    const seconds = Math.ceil((result.retryAfter ?? HOUR) / 1000);
    throw new Error(
      `Statement upsert rate limit exceeded (${policy.maxImportsPerHour}/hour). Retry in ~${seconds}s.`,
    );
  }
}
