import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ProcessingView } from "@/components/money/processing-view";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatTxnDate,
} from "@/lib/money/format";
import type { MoneyAccount, SyncedTransferPair } from "@/lib/money/types";

type Step = "syncing" | "review" | "empty" | "error";

type SyncTransfersWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MoneyAccount[];
  onSyncTransfers: () => Promise<SyncedTransferPair[]>;
  onRejectTransferPairs: (outIds: string[]) => void | Promise<void>;
};

export function SyncTransfersWizard({
  open,
  onOpenChange,
  accounts,
  onSyncTransfers,
  onRejectTransferPairs,
}: SyncTransfersWizardProps) {
  const [step, setStep] = useState<Step>("syncing");
  const [pairs, setPairs] = useState<SyncedTransferPair[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const syncFnRef = useRef(onSyncTransfers);
  syncFnRef.current = onSyncTransfers;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const busy = step === "syncing";

  useEffect(() => {
    if (!open) {
      setStep("syncing");
      setPairs([]);
      setSelected(new Set());
      setPending(false);
      setError(null);
      return;
    }

    const runId = ++runIdRef.current;
    setStep("syncing");
    setError(null);

    void (async () => {
      try {
        const found = await syncFnRef.current();
        if (runId !== runIdRef.current) return;
        if (found.length === 0) {
          setPairs([]);
          setStep("empty");
          return;
        }
        setPairs(found);
        setSelected(new Set());
        setStep("review");
      } catch (err) {
        if (runId !== runIdRef.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to sync transfers",
        );
        setStep("error");
      }
    })();
  }, [open]);

  const allSelected =
    pairs.length > 0 && pairs.every((pair) => selected.has(pair.outId));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(pairs.map((pair) => pair.outId)));
  }

  function toggleOne(outId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(outId)) next.delete(outId);
      else next.add(outId);
      return next;
    });
  }

  async function rejectIds(outIds: string[]) {
    if (outIds.length === 0) return;
    setPending(true);
    try {
      await onRejectTransferPairs(outIds);
      setPairs((prev) => prev.filter((pair) => !outIds.includes(pair.outId)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of outIds) next.delete(id);
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  const title =
    step === "syncing"
      ? "Syncing transfers"
      : step === "empty"
        ? "No new transfers"
        : step === "error"
          ? "Sync failed"
          : "Review synced transfers";

  const description =
    step === "review"
      ? `${pairs.length} pair${pairs.length === 1 ? "" : "s"} marked as transfers. Remove any that are not transfers.`
      : step === "empty"
        ? "No matching transfer pairs were found across your accounts."
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
      {step === "syncing" ? (
        <ProcessingView
          title="Looking for transfers…"
          detail="Matching debits and credits across accounts"
        />
      ) : null}

      {step === "empty" || step === "error" ? (
        <div className="flex flex-col gap-4">
          {error ? (
            <p className="text-body-sm text-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-body-sm text-on-surface/60">
              Nothing new to review right now.
            </p>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="flex flex-col gap-3">
          {pairs.length > 0 ? (
            <label className="flex items-center gap-2 text-body-sm text-on-surface/70">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={pending}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Select all
            </label>
          ) : (
            <p className="text-body-sm text-on-surface/60">
              No transfer pairs left to review.
            </p>
          )}

          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {pairs.map((pair) => {
              const outAccount = accountById.get(pair.outAccountId);
              const inAccount = accountById.get(pair.inAccountId);
              const currency =
                outAccount?.currency ?? inAccount?.currency ?? DEFAULT_CURRENCY;
              return (
                <li
                  key={pair.outId}
                  className="rounded-md border border-white/5 bg-surface-container-highest/40 px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(pair.outId)}
                      onChange={() => toggleOne(pair.outId)}
                      disabled={pending}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                      aria-label={`Select transfer of ${formatMoney(pair.amount, currency)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-body-sm font-medium text-white">
                        <span className="truncate">
                          {outAccount?.name ?? "Unknown account"}
                        </span>
                        <ArrowRight
                          className="h-3.5 w-3.5 shrink-0 text-on-surface/40"
                          aria-hidden
                        />
                        <span className="truncate">
                          {inAccount?.name ?? "Unknown account"}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-body-sm text-on-surface/80">
                        {formatMoney(pair.amount, currency)}
                      </p>
                      <p className="mt-1 text-label-caps text-on-surface/40">
                        Out {formatTxnDate(pair.outDate)}
                        {pair.outDescription
                          ? ` · ${pair.outDescription}`
                          : ""}
                        {" · "}
                        In {formatTxnDate(pair.inDate)}
                        {pair.inDescription
                          ? ` · ${pair.inDescription}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        void rejectIds([pair.outId]);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || selected.size === 0}
              onClick={() => {
                void rejectIds([...selected]);
              }}
            >
              Remove selected
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </Dialog>
  );
}
