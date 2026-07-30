import { Plus, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

type MoneyEmptyStateProps = {
  hasUnsynced: boolean;
  unsyncedCount: number;
  syncPending: boolean;
  syncError: string | null;
  onAddAccount: () => void;
  onSync: () => void;
};

export function MoneyEmptyState({
  hasUnsynced,
  unsyncedCount,
  syncPending,
  syncError,
  onAddAccount,
  onSync,
}: MoneyEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Wallet className="h-7 w-7" aria-hidden />
      </div>

      {hasUnsynced ? (
        <>
          <h2 className="text-title-md font-medium text-white">
            Statements ready to sync
          </h2>
          <p className="mt-2 max-w-md text-body-sm text-on-surface/60">
            You have {unsyncedCount} imported statement
            {unsyncedCount === 1 ? "" : "s"} that{" "}
            {unsyncedCount === 1 ? "has" : "have"} not been synced to your
            ledger yet. Sync to create accounts and transactions, or add an
            account manually.
          </p>
          {syncError ? (
            <p className="mt-3 text-body-sm text-error">{syncError}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={onSync}
              disabled={syncPending}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncPending ? "animate-spin" : ""}`}
                aria-hidden
              />
              {syncPending ? "Syncing…" : "Sync to ledger"}
            </Button>
            <Button type="button" variant="secondary" onClick={onAddAccount}>
              <Plus className="h-4 w-4" aria-hidden />
              Add account
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-title-md font-medium text-white">
            No accounts yet
          </h2>
          <p className="mt-2 max-w-md text-body-sm text-on-surface/60">
            Add your first account to start tracking balances, cash flow, and
            transactions in Money.
          </p>
          <div className="mt-6">
            <Button type="button" onClick={onAddAccount}>
              <Plus className="h-4 w-4" aria-hidden />
              Add account
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
