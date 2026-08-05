"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { parseBytes } from "@nook/pipeline/parse-file";
import { buildConvexWritePayload } from "@nook/persistence/convex-writer";
import {
  assertPdfMagic,
  mapImportError,
  PARSED_TXN_CHUNK_SIZE,
  sanitizeSourcePath,
} from "./lib/importPolicy";

type ImportResult = {
  ok: boolean;
  errors?: string[];
  statementId?: Id<"parsedStatements">;
  action?: "created" | "replaced" | "no-op";
  bank?: string;
  accountNumberMasked?: string;
  periodStart?: string;
  periodEnd?: string;
  transactionCount?: number;
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
  accountExists: boolean;
  validationPassed?: boolean;
  filename?: string;
};

const importResultValidator = v.object({
  ok: v.boolean(),
  errors: v.optional(v.array(v.string())),
  statementId: v.optional(v.id("parsedStatements")),
  action: v.optional(
    v.union(
      v.literal("created"),
      v.literal("replaced"),
      v.literal("no-op"),
    ),
  ),
  bank: v.optional(v.string()),
  accountNumberMasked: v.optional(v.string()),
  periodStart: v.optional(v.string()),
  periodEnd: v.optional(v.string()),
  transactionCount: v.optional(v.number()),
  openingBalance: v.optional(v.number()),
  closingBalance: v.optional(v.number()),
  currency: v.optional(v.string()),
  accountExists: v.boolean(),
  validationPassed: v.optional(v.boolean()),
  filename: v.optional(v.string()),
});

export const importUploadedStatement = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: importResultValidator,
  handler: async (ctx, args): Promise<ImportResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let storageDeleted = false;
    const deleteStorage = async () => {
      if (storageDeleted) return;
      storageDeleted = true;
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore
      }
    };

    try {
      const owned = await ctx.runMutation(
        internal.statementUpload.consumeOwnedUpload,
        { storageId: args.storageId },
      );
      if (!owned) {
        await deleteStorage();
        return {
          ok: false,
          errors: ["Upload not found or not owned by you"],
          accountExists: false,
        };
      }

      const blob = await ctx.storage.get(args.storageId);
      if (!blob) {
        return {
          ok: false,
          errors: ["Uploaded file not found"],
          accountExists: false,
          filename: owned.filename,
        };
      }

      // Prefer blob.size before buffering (avoids loading oversize into RAM).
      if (typeof blob.size === "number" && blob.size > owned.byteSize) {
        await deleteStorage();
        return {
          ok: false,
          errors: ["File exceeds size limit"],
          accountExists: false,
          filename: owned.filename,
        };
      }

      const arrayBuffer = await blob.arrayBuffer();
      if (arrayBuffer.byteLength > owned.byteSize) {
        await deleteStorage();
        return {
          ok: false,
          errors: ["File exceeds size limit"],
          accountExists: false,
          filename: owned.filename,
        };
      }

      const bytes = new Uint8Array(arrayBuffer);
      try {
        assertPdfMagic(bytes);
      } catch (err) {
        await deleteStorage();
        return {
          ok: false,
          errors: [mapImportError(err)],
          accountExists: false,
          filename: owned.filename,
        };
      }

      const filename = sanitizeSourcePath(owned.filename);
      const result = await parseBytes(bytes, filename);

      if (!result.statement) {
        await deleteStorage();
        return {
          ok: false,
          errors:
            result.errors.length > 0
              ? result.errors.map((e) => `${e.code}: ${e.message}`)
              : ["Could not parse statement"],
          accountExists: false,
          ...(result.validation
            ? { validationPassed: result.validation.passed }
            : {}),
          filename,
        };
      }

      const validationPassed = result.validation?.passed ?? false;
      const payload = buildConvexWritePayload(result);
      payload.sourcePath = filename;

      const upsert = await ctx.runMutation(
        internal.statements.upsertStatementMetaFromImport,
        {
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
          sourcePath: payload.sourcePath,
          validationPassed,
        },
      );

      if (upsert.action !== "no-op") {
        for (
          let i = 0;
          i < payload.transactions.length;
          i += PARSED_TXN_CHUNK_SIZE
        ) {
          const chunk = payload.transactions.slice(
            i,
            i + PARSED_TXN_CHUNK_SIZE,
          );
          await ctx.runMutation(
            internal.statements.appendParsedTransactionChunk,
            {
              statementId: upsert.statementId,
              transactions: chunk,
            },
          );
        }
      }

      const accountExists: boolean = await ctx.runQuery(
        api.statementUpload.existsByFingerprint,
        {
          institution: payload.bank,
          accountFingerprint: payload.accountFingerprint,
        },
      );

      await deleteStorage();

      return {
        ok: true,
        statementId: upsert.statementId,
        action: upsert.action,
        bank: payload.bank,
        accountNumberMasked: payload.accountNumberMasked,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        transactionCount: payload.transactionCount,
        openingBalance: payload.openingBalance,
        closingBalance: payload.closingBalance,
        currency: payload.currency,
        accountExists,
        validationPassed,
        filename,
        ...(result.errors.length > 0 && !validationPassed
          ? {
              errors: result.errors.map((e) => `${e.code}: ${e.message}`),
            }
          : {}),
      };
    } catch (err) {
      await deleteStorage();
      return {
        ok: false,
        errors: [mapImportError(err)],
        accountExists: false,
      };
    }
  },
});
