import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountCard } from "@/components/money/account-card";
import { AccountFormDialog } from "@/components/money/account-form-dialog";
import { formatMoney } from "@/lib/money/format";
import type {
  AccountInput,
  MoneyAccount,
} from "@/lib/money/types";

type AccountsSectionProps = {
  accounts: MoneyAccount[];
  totalBalance: number;
  onCreate: (input: AccountInput) => void;
  onUpdate: (id: string, input: AccountInput) => void;
  onDelete: (id: string) => void;
};

export function AccountsSection({
  accounts,
  totalBalance,
  onCreate,
  onUpdate,
  onDelete,
}: AccountsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyAccount | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: MoneyAccount) {
    setEditing(account);
    setDialogOpen(true);
  }

  return (
    <section aria-labelledby="accounts-heading">
      <div className="mb-stack-sm flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="accounts-heading"
            className="text-title-md font-medium text-white"
          >
            Accounts
          </h2>
          <p className="mt-1 text-body-sm text-on-surface/60">
            Total balance:{" "}
            <span className="font-mono text-on-surface">
              {formatMoney(totalBalance)}
            </span>
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Add account
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onClick={() => openEdit(account)}
          />
        ))}
      </div>

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
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
