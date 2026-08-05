import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUser } from "./lib/auth";
import { DEFAULT_IMPORT_POLICY } from "./lib/importPolicy";
import { getImportPolicyForUser } from "./importRateLimit";

function adminUsernames(): Set<string> {
  const raw = process.env.IMPORT_LIMIT_ADMIN_USERNAMES ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function requireLimitAdmin(username: string | undefined): void {
  const admins = adminUsernames();
  if (admins.size === 0) {
    throw new Error(
      "IMPORT_LIMIT_ADMIN_USERNAMES is not configured on this deployment",
    );
  }
  const normalized = username?.trim().toLowerCase();
  if (!normalized || !admins.has(normalized)) {
    throw new Error("Not authorized to manage import limit overrides");
  }
}

const policyValidator = v.object({
  maxImportsPerHour: v.number(),
  maxFilesPerBatch: v.number(),
  maxBytesPerFile: v.number(),
  maxBytesPerBatch: v.number(),
});

export const getMyImportPolicy = query({
  args: {},
  returns: policyValidator,
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    return await getImportPolicyForUser(ctx, user);
  },
});

export const listImportLimitOverrides = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("importLimitOverrides"),
      username: v.string(),
      maxImportsPerHour: v.number(),
      maxFilesPerBatch: v.number(),
      maxBytesPerFile: v.number(),
      maxBytesPerBatch: v.number(),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    requireLimitAdmin(user.username);
    return await ctx.db.query("importLimitOverrides").collect();
  },
});

export const upsertImportLimitOverride = mutation({
  args: {
    username: v.string(),
    maxImportsPerHour: v.number(),
    maxFilesPerBatch: v.number(),
    maxBytesPerFile: v.number(),
    maxBytesPerBatch: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("importLimitOverrides"),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    requireLimitAdmin(user.username);

    const username = args.username.trim().toLowerCase();
    if (!username) throw new Error("Username is required");
    if (args.maxImportsPerHour < 1 || args.maxFilesPerBatch < 1) {
      throw new Error("Limits must be at least 1");
    }

    const existing = await ctx.db
      .query("importLimitOverrides")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    const doc = {
      username,
      maxImportsPerHour: args.maxImportsPerHour,
      maxFilesPerBatch: args.maxFilesPerBatch,
      maxBytesPerFile: args.maxBytesPerFile,
      maxBytesPerBatch: args.maxBytesPerBatch,
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("importLimitOverrides", doc);
  },
});

export const removeImportLimitOverride = mutation({
  args: { username: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    requireLimitAdmin(user.username);
    const username = args.username.trim().toLowerCase();
    const existing = await ctx.db
      .query("importLimitOverrides")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const defaultImportPolicy = query({
  args: {},
  returns: policyValidator,
  handler: async () => {
    return { ...DEFAULT_IMPORT_POLICY };
  },
});
