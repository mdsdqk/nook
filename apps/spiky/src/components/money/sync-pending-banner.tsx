import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncPendingBannerProps = {
  count: number;
  syncPending: boolean;
  syncError: string | null;
  onSync: () => void;
};

export function SyncPendingBanner({
  count,
  syncPending,
  syncError,
  onSync,
}: SyncPendingBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
      <div className="min-w-0">
        <p className="text-body-sm text-on-surface">
          {count} imported statement{count === 1 ? "" : "s"} not yet synced to
          the ledger.
        </p>
        {syncError ? (
          <p className="mt-1 text-body-sm text-error">{syncError}</p>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onSync}
        disabled={syncPending}
      >
        <RefreshCw
          className={`h-4 w-4 ${syncPending ? "animate-spin" : ""}`}
          aria-hidden
        />
        {syncPending ? "Syncing…" : "Sync to ledger"}
      </Button>
    </div>
  );
}
