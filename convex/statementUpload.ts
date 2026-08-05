import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAppUser } from "./lib/auth";
import {
  assertPdfFilename,
  STATEMENT_UPLOAD_TTL_MS,
} from "./lib/importPolicy";
import {
  consumeStatementImportQuota,
  getImportPolicyForUser,
} from "./importRateLimit";

export { MAX_STATEMENT_PDF_BYTES } from "./lib/statementImportLimits";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getAppUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const existsByFingerprint = query({
  args: {
    institution: v.string(),
    accountFingerprint: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_fingerprint", (q) =>
        q
          .eq("userId", user._id)
          .eq("institution", args.institution)
          .eq("accountFingerprint", args.accountFingerprint),
      )
      .first();
    return account !== null;
  },
});

/**
 * Register ownership of a just-uploaded blob and consume one import token.
 * Call after POST to the upload URL, before the parse action.
 */
export const claimStatementUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    byteSize: v.number(),
  },
  returns: v.id("statementUploads"),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const policy = await getImportPolicyForUser(ctx, user);
    const filename = assertPdfFilename(args.filename);

    if (args.byteSize <= 0) {
      throw new Error("Invalid file size");
    }
    if (args.byteSize > policy.maxBytesPerFile) {
      throw new Error(
        `File exceeds ${Math.floor(policy.maxBytesPerFile / (1024 * 1024))}MB limit`,
      );
    }

    const existing = await ctx.db
      .query("statementUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      if (existing.userId !== user._id) {
        throw new Error("Upload ownership conflict");
      }
      return existing._id;
    }

    await consumeStatementImportQuota(ctx, user, 1);

    return await ctx.db.insert("statementUploads", {
      storageId: args.storageId,
      userId: user._id,
      filename,
      byteSize: args.byteSize,
      createdAt: Date.now(),
    });
  },
});

export const getOwnedUpload = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(
    v.object({
      _id: v.id("statementUploads"),
      filename: v.string(),
      byteSize: v.number(),
      userId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const row = await ctx.db
      .query("statementUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (!row || row.userId !== user._id) return null;
    return {
      _id: row._id,
      filename: row.filename,
      byteSize: row.byteSize,
      userId: row.userId,
    };
  },
});

export const consumeOwnedUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.union(
    v.object({
      filename: v.string(),
      byteSize: v.number(),
      userId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const row = await ctx.db
      .query("statementUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (!row || row.userId !== user._id) return null;
    await ctx.db.delete(row._id);
    return {
      filename: row.filename,
      byteSize: row.byteSize,
      userId: row.userId,
    };
  },
});

/** Delete orphaned upload claims (+ storage blobs) older than TTL. */
export const cleanupExpiredUploads = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - STATEMENT_UPLOAD_TTL_MS;
    const expired = await ctx.db
      .query("statementUploads")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(50);

    let deleted = 0;
    for (const row of expired) {
      try {
        await ctx.storage.delete(row.storageId);
      } catch {
        // ignore missing blob
      }
      await ctx.db.delete(row._id);
      deleted++;
    }
    return { deleted };
  },
});
