/** Soft defaults — keep in sync with convex/lib/importPolicy DEFAULT_IMPORT_POLICY. */
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

export const MAX_STATEMENT_PDF_BYTES = DEFAULT_IMPORT_POLICY.maxBytesPerFile;

export type StatementImportResult = {
  ok: boolean;
  errors?: string[];
  statementId?: string;
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

export type StatementSyncResult = {
  statementId: string;
  accountId: string;
  assertionsUpserted: number;
  transactionsUpserted: number;
  transactionsSkipped: number;
  accountCreated: boolean;
};

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) return false;
  if (file.type && file.type !== "application/pdf") return false;
  return true;
}

export function filterStatementFiles(
  files: FileList | File[],
  policy: ImportPolicy = DEFAULT_IMPORT_POLICY,
): {
  accepted: File[];
  rejected: { name: string; reason: string }[];
} {
  const accepted: File[] = [];
  const rejected: { name: string; reason: string }[] = [];
  let batchBytes = 0;

  for (const file of Array.from(files)) {
    if (!isPdfFile(file)) {
      rejected.push({ name: file.name, reason: "Only PDF files are supported" });
      continue;
    }
    if (file.size > policy.maxBytesPerFile) {
      rejected.push({
        name: file.name,
        reason: `Exceeds ${Math.floor(policy.maxBytesPerFile / (1024 * 1024))}MB limit`,
      });
      continue;
    }
    if (accepted.length >= policy.maxFilesPerBatch) {
      rejected.push({
        name: file.name,
        reason: `Batch limit is ${policy.maxFilesPerBatch} files`,
      });
      continue;
    }
    if (batchBytes + file.size > policy.maxBytesPerBatch) {
      rejected.push({
        name: file.name,
        reason: "Would exceed batch size limit",
      });
      continue;
    }
    accepted.push(file);
    batchBytes += file.size;
  }

  return { accepted, rejected };
}
