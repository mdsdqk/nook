import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFiltersBar } from "@/components/money/transaction-filters";
import { TransactionRow } from "@/components/money/transaction-row";
import { TransactionFormDialog } from "@/components/money/transaction-form-dialog";
import { SyncTransfersReviewDialog } from "@/components/money/sync-transfers-review-dialog";
import type {
  MoneyAccount,
  MoneyTransaction,
  SyncedTransferPair,
  TransactionFilters,
  TransactionInput,
} from "@/lib/money/types";

type TransactionsSectionProps = {
  accounts: MoneyAccount[];
  creditCards: MoneyAccount[];
  transactions: MoneyTransaction[];
  filters: TransactionFilters;
  onFiltersChange: (next: TransactionFilters) => void;
  onCreate: (input: TransactionInput) => void | Promise<void>;
  onUpdate: (id: string, input: TransactionInput) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSyncTransfers: () => Promise<SyncedTransferPair[]>;
  onRejectTransferPairs: (outIds: string[]) => Promise<void>;
};

export function TransactionsSection({
  accounts,
  creditCards,
  transactions,
  filters,
  onFiltersChange,
  onCreate,
  onUpdate,
  onDelete,
  onSyncTransfers,
  onRejectTransferPairs,
}: TransactionsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyTransaction | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPairs, setReviewPairs] = useState<SyncedTransferPair[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(txn: MoneyTransaction) {
    setEditing(txn);
    setDialogOpen(true);
  }

  async function handleSyncTransfers() {
    setMenuOpen(false);
    setSyncPending(true);
    setSyncMessage(null);
    try {
      const pairs = await onSyncTransfers();
      if (pairs.length === 0) {
        setSyncMessage("No new transfers found.");
        return;
      }
      setReviewPairs(pairs);
      setReviewOpen(true);
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : "Failed to sync transfers",
      );
    } finally {
      setSyncPending(false);
    }
  }

  return (
    <section aria-labelledby="transactions-heading">
      <div className="mb-stack-sm flex flex-wrap items-end justify-between gap-3">
        <h2
          id="transactions-heading"
          className="text-title-md font-medium text-white"
        >
          Transactions
        </h2>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add transaction
          </Button>
          <div className="relative" ref={menuRef}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="More transaction options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              disabled={syncPending}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreVertical className="h-4 w-4" aria-hidden />
            </Button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 z-20 mt-2 min-w-48 overflow-hidden rounded-md border border-white/10 bg-surface-container-low shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-default items-center px-3 py-2.5 text-left text-body-sm text-on-surface/40"
                  disabled
                >
                  Import statements
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center px-3 py-2.5 text-left text-body-sm text-on-surface hover:bg-white/5 disabled:cursor-default disabled:opacity-50"
                  disabled={syncPending}
                  onClick={() => {
                    void handleSyncTransfers();
                  }}
                >
                  {syncPending ? "Syncing transfers…" : "Sync transfers"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {syncMessage ? (
        <p className="mb-stack-sm text-body-sm text-on-surface/60" role="status">
          {syncMessage}
        </p>
      ) : null}

      <TransactionFiltersBar
        filters={filters}
        onChange={onFiltersChange}
        accounts={accounts}
        creditCards={creditCards}
      />

      <div className="mt-stack-sm rounded-lg border border-white/5 bg-surface-container-low/40 px-3">
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-body-sm text-on-surface/50">
            No transactions match these filters.
          </p>
        ) : (
          transactions.map((txn) => {
            const account = accountById.get(txn.accountId);
            return (
              <TransactionRow
                key={txn.id}
                transaction={txn}
                {...(account ? { account } : {})}
                onClick={() => openEdit(txn)}
              />
            );
          })
        )}
      </div>

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        accounts={accounts}
        onSave={async (input) => {
          if (editing) await onUpdate(editing.id, input);
          else await onCreate(input);
        }}
        {...(editing
          ? {
              onDelete: async () => {
                await onDelete(editing.id);
              },
            }
          : {})}
      />

      <SyncTransfersReviewDialog
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) setReviewPairs([]);
        }}
        pairs={reviewPairs}
        accounts={accounts}
        onReject={async (outIds) => {
          await onRejectTransferPairs(outIds);
          setReviewPairs((prev) =>
            prev.filter((pair) => !outIds.includes(pair.outId)),
          );
        }}
      />
    </section>
  );
}
