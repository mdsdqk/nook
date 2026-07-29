import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFiltersBar } from "@/components/money/transaction-filters";
import { TransactionRow } from "@/components/money/transaction-row";
import { TransactionFormDialog } from "@/components/money/transaction-form-dialog";
import type {
  MoneyAccount,
  MoneyTransaction,
  TransactionFilters,
  TransactionInput,
} from "@/lib/money/types";

type TransactionsSectionProps = {
  accounts: MoneyAccount[];
  creditCards: MoneyAccount[];
  transactions: MoneyTransaction[];
  filters: TransactionFilters;
  onFiltersChange: (next: TransactionFilters) => void;
  onCreate: (input: TransactionInput) => void;
  onUpdate: (id: string, input: TransactionInput) => void;
  onDelete: (id: string) => void;
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
}: TransactionsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyTransaction | null>(null);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(txn: MoneyTransaction) {
    setEditing(txn);
    setDialogOpen(true);
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
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Add transaction
        </Button>
      </div>

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
        onSave={(input) => {
          if (editing) onUpdate(editing.id, input);
          else onCreate(input);
        }}
        {...(editing
          ? {
              onDelete: () => {
                onDelete(editing.id);
              },
            }
          : {})}
      />
    </section>
  );
}
