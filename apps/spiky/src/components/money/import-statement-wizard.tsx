import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ImportDropzone } from "@/components/money/import-dropzone";
import { ImportSummaryView } from "@/components/money/import-summary-view";
import { ProcessingView } from "@/components/money/processing-view";
import {
  DEFAULT_IMPORT_POLICY,
  type ImportPolicy,
  type StatementImportResult,
  type StatementSyncResult,
} from "@/lib/money/statement-import";

type Step = "dropzone" | "processing" | "summary" | "syncing" | "synced";

type ImportStatementWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportFile: (file: File) => Promise<StatementImportResult>;
  onSyncStatement: (statementId: string) => Promise<StatementSyncResult>;
  policy?: ImportPolicy;
};

export function ImportStatementWizard({
  open,
  onOpenChange,
  onImportFile,
  onSyncStatement,
  policy = DEFAULT_IMPORT_POLICY,
}: ImportStatementWizardProps) {
  const [step, setStep] = useState<Step>("dropzone");
  const [results, setResults] = useState<StatementImportResult[]>([]);
  const [syncResults, setSyncResults] = useState<StatementSyncResult[]>([]);
  const [progressLabel, setProgressLabel] = useState("Importing…");
  const [progressDetail, setProgressDetail] = useState<string | undefined>();
  const [syncError, setSyncError] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const busy = step === "processing" || step === "syncing";

  useEffect(() => {
    if (!open) {
      setStep("dropzone");
      setResults([]);
      setSyncResults([]);
      setProgressLabel("Importing…");
      setProgressDetail(undefined);
      setSyncError(null);
    }
  }, [open]);

  const syncable = results.filter(
    (r) => r.ok && r.validationPassed && r.statementId,
  );

  async function runImport(files: File[]) {
    setStep("processing");
    setResults([]);
    setSyncError(null);
    const next: StatementImportResult[] = [];

    for (let i = 0; i < files.length; i++) {
      if (!openRef.current) return;
      const file = files[i]!;
      setProgressLabel(`Importing ${i + 1} of ${files.length}`);
      setProgressDetail(file.name);
      try {
        const result = await onImportFile(file);
        next.push(result);
      } catch (err) {
        next.push({
          ok: false,
          accountExists: false,
          filename: file.name,
          errors: [
            err instanceof Error ? err.message : "Import failed unexpectedly",
          ],
        });
      }
      setResults([...next]);
    }

    if (!openRef.current) return;
    setStep("summary");
  }

  async function runLedgerSync() {
    setStep("syncing");
    setSyncError(null);
    setProgressLabel("Syncing to ledger…");
    const synced: StatementSyncResult[] = [];

    for (let i = 0; i < syncable.length; i++) {
      if (!openRef.current) return;
      const item = syncable[i]!;
      setProgressDetail(
        item.bank
          ? `${item.bank} · ${item.periodStart ?? ""} – ${item.periodEnd ?? ""}`
          : item.filename,
      );
      setProgressLabel(`Syncing ${i + 1} of ${syncable.length}`);
      try {
        const result = await onSyncStatement(item.statementId!);
        synced.push(result);
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : "Ledger sync failed",
        );
        setSyncResults(synced);
        setStep("summary");
        return;
      }
    }

    if (!openRef.current) return;
    setSyncResults(synced);
    setStep("synced");
  }

  const title =
    step === "dropzone"
      ? "Import statements"
      : step === "processing"
        ? "Processing"
        : step === "summary"
          ? "Import results"
          : step === "syncing"
            ? "Syncing"
            : "Synced to ledger";

  const description =
    step === "dropzone"
      ? `Up to ${policy.maxFilesPerBatch} PDFs per batch · ${policy.maxImportsPerHour} imports/hour.`
      : step === "summary"
        ? "Parsed statements are saved. Sync to create accounts and ledger transactions, or close to keep parsed data only."
        : step === "synced"
          ? "Statements were promoted into your ledger."
          : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      dismissible={!busy}
      {...(description ? { description } : {})}
      className="w-[min(100%-2rem,36rem)]"
    >
      {step === "dropzone" ? (
        <ImportDropzone
          policy={policy}
          onFiles={(files) => void runImport(files)}
        />
      ) : null}

      {step === "processing" || step === "syncing" ? (
        <ProcessingView
          title={progressLabel}
          {...(progressDetail ? { detail: progressDetail } : {})}
        />
      ) : null}

      {step === "summary" ? (
        <div className="flex flex-col gap-4">
          <ImportSummaryView results={results} />
          {syncError ? (
            <p className="text-body-sm text-error" role="alert">
              {syncError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={syncable.length === 0}
              onClick={() => {
                void runLedgerSync();
              }}
            >
              Sync to ledger
              {syncable.length > 0 ? ` (${syncable.length})` : ""}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {step === "synced" ? (
        <div className="flex flex-col gap-4">
          <ul className="space-y-2">
            {syncResults.map((result) => (
              <li
                key={result.statementId}
                className="rounded-md border border-white/5 bg-surface-container-highest/40 px-4 py-3 text-body-sm text-on-surface/80"
              >
                {result.transactionsUpserted} transaction
                {result.transactionsUpserted === 1 ? "" : "s"} synced
                {result.accountCreated ? " · New account added" : ""}
                {result.assertionsUpserted > 0
                  ? ` · ${result.assertionsUpserted} balance assertion${result.assertionsUpserted === 1 ? "" : "s"}`
                  : ""}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </Dialog>
  );
}
