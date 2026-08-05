import { HOUR } from "@convex-dev/rate-limiter";
import type { Doc } from "../_generated/dataModel";

/** Soft defaults — Spiky client mirrors these. */
export const DEFAULT_IMPORT_POLICY: ImportPolicy = {
  maxImportsPerHour: 5,
  maxFilesPerBatch: 5,
  maxBytesPerFile: 20 * 1024 * 1024,
  maxBytesPerBatch: 5 * 20 * 1024 * 1024,
};

export type ImportPolicy = {
  maxImportsPerHour: number;
  maxFilesPerBatch: number;
  maxBytesPerFile: number;
  maxBytesPerBatch: number;
};

export function resolveImportPolicy(
  override: Doc<"importLimitOverrides"> | null,
): ImportPolicy {
  if (!override) {
    return { ...DEFAULT_IMPORT_POLICY };
  }
  return {
    maxImportsPerHour: override.maxImportsPerHour,
    maxFilesPerBatch: override.maxFilesPerBatch,
    maxBytesPerFile: override.maxBytesPerFile,
    maxBytesPerBatch: override.maxBytesPerBatch,
  };
}

export function importHourlyLimitConfig(policy: ImportPolicy) {
  return {
    kind: "fixed window" as const,
    rate: policy.maxImportsPerHour,
    period: HOUR,
    capacity: policy.maxImportsPerHour,
  };
}

/** Keep Node action → mutation args well under the 5 MiB Node limit. */
export const PARSED_TXN_CHUNK_SIZE = 40;

/** Orphan upload TTL (ms). */
export const STATEMENT_UPLOAD_TTL_MS = 60 * 60 * 1000;

/**
 * Sanitize client filenames for storage as sourcePath.
 * Basename only, strip control chars, cap length.
 */
export function sanitizeSourcePath(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "statement.pdf";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .trim();
  const truncated = cleaned.slice(0, 180);
  return truncated.length > 0 ? truncated : "statement.pdf";
}

/** Require .pdf suffix (case-insensitive) after sanitization. */
export function assertPdfFilename(filename: string): string {
  const safe = sanitizeSourcePath(filename);
  if (!safe.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are accepted");
  }
  return safe;
}

/** PDF magic header check. */
export function assertPdfMagic(bytes: Uint8Array): void {
  if (bytes.byteLength < 5) {
    throw new Error("File is too small to be a PDF");
  }
  const header = String.fromCharCode(
    bytes[0]!,
    bytes[1]!,
    bytes[2]!,
    bytes[3]!,
    bytes[4]!,
  );
  if (!header.startsWith("%PDF-")) {
    throw new Error("File is not a valid PDF");
  }
}

export function mapImportError(err: unknown): string {
  if (!(err instanceof Error)) return "Import failed unexpectedly";
  const msg = err.message;
  if (/rate limit|RateLimited/i.test(msg)) {
    return "Import rate limit exceeded. Try again later.";
  }
  if (/Only PDF|not a valid PDF|too small/i.test(msg)) {
    return msg;
  }
  if (/exceeds|too large|File size/i.test(msg)) {
    return msg;
  }
  if (/Not authenticated|User not found|Upload|ownership|not found/i.test(msg)) {
    return msg;
  }
  if (/ArgumentValidation|Too big|16 MiB|5 MiB/i.test(msg)) {
    return "Statement is too large to import in one request.";
  }
  return "Import failed. Please try again.";
}
