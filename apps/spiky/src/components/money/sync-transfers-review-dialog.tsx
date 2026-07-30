import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatTxnDate,
} from "@/lib/money/format";
import type { MoneyAccount, SyncedTransferPair } from "@/lib/money/types";

type SyncTransfersReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairs: SyncedTransferPair[];
  accounts: MoneyAccount[];
  onReject: (outIds: string[]) => void | Promise<void>;
};

export function SyncTransfersReviewDialog({
  open,
  onOpenChange,
  pairs,
  accounts,
  onReject,
}: SyncTransfersReviewDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setPending(false);
    }
  }, [open, pairs]);

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
      await onReject(outIds);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of outIds) next.delete(id);
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Review synced transfers"
      description={
        pairs.length === 0
          ? "No transfer pairs left to review."
          : `${pairs.length} pair${pairs.length === 1 ? "" : "s"} marked as transfers. Remove any that are not transfers.`
      }
      className="w-[min(100%-2rem,36rem)]"
    >
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
        ) : null}

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
                      {pair.inDescription ? ` · ${pair.inDescription}` : ""}
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
      </div>

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
    </Dialog>
  );
}
