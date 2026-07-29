import { useEffect, useState, type FormEvent } from "react";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_TYPE_REGISTRY,
  type TransactionType,
} from "@nook/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogFooter,
  FieldLabel,
  Select,
  Textarea,
} from "@/components/ui/dialog";
import type {
  MoneyAccount,
  MoneyTransaction,
  TransactionInput,
} from "@/lib/money/types";

const TYPE_OPTIONS = (
  Object.keys(TRANSACTION_TYPE_REGISTRY) as TransactionType[]
).filter((t) => t !== "obligation");

type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: MoneyTransaction | null;
  accounts: MoneyAccount[];
  onSave: (input: TransactionInput) => void;
  onDelete?: () => void;
};

function toInput(
  transaction: MoneyTransaction | null | undefined,
  accounts: MoneyAccount[],
): TransactionInput {
  return {
    accountId: transaction?.accountId ?? accounts[0]?.id ?? "",
    date: transaction?.date ?? new Date().toISOString().slice(0, 10),
    type: transaction?.type ?? "expense",
    amount: transaction?.amount ?? 0,
    description: transaction?.description ?? "",
    narration: transaction?.narration ?? "",
    merchant: transaction?.merchant ?? "",
    category: transaction?.category ?? "Other",
    notes: transaction?.notes ?? "",
  };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  onSave,
  onDelete,
}: TransactionFormDialogProps) {
  const isEdit = Boolean(transaction);
  const [form, setForm] = useState<TransactionInput>(() =>
    toInput(transaction, accounts),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toInput(transaction, accounts));
    setError(null);
  }, [open, transaction, accounts]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.accountId) {
      setError("Account is required");
      return;
    }
    if (!form.amount || form.amount <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    const input: TransactionInput = {
      accountId: form.accountId,
      date: form.date,
      type: form.type,
      amount: form.amount,
    };
    const description = form.description?.trim();
    if (description) input.description = description;
    const narration = form.narration?.trim();
    if (narration) input.narration = narration;
    const merchant = form.merchant?.trim();
    if (merchant) input.merchant = merchant;
    const category = form.category?.trim();
    if (category) input.category = category;
    const notes = form.notes?.trim();
    if (notes) input.notes = notes;
    onSave(input);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit transaction" : "Add transaction"}
      description="Changes apply to the local mock store."
      className="w-[min(100%-2rem,32rem)]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <FieldLabel htmlFor="txn-account">Account</FieldLabel>
          <Select
            id="txn-account"
            value={form.accountId}
            onChange={(e) =>
              setForm((f) => ({ ...f, accountId: e.target.value }))
            }
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="txn-type">Type</FieldLabel>
            <Select
              id="txn-type"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as TransactionType,
                }))
              }
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {TRANSACTION_TYPE_REGISTRY[type].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="txn-amount">Amount</FieldLabel>
            <Input
              id="txn-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: Number(e.target.value),
                }))
              }
              required
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="txn-date">Date</FieldLabel>
          <Input
            id="txn-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor="txn-merchant">Merchant</FieldLabel>
          <Input
            id="txn-merchant"
            value={form.merchant ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, merchant: e.target.value }))
            }
          />
        </div>

        <div>
          <FieldLabel htmlFor="txn-description">Description</FieldLabel>
          <Input
            id="txn-description"
            value={form.description ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>

        <div>
          <FieldLabel htmlFor="txn-category">Category</FieldLabel>
          <Select
            id="txn-category"
            value={form.category ?? "Other"}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            {TRANSACTION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FieldLabel htmlFor="txn-narration">Narration</FieldLabel>
          <Input
            id="txn-narration"
            value={form.narration ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, narration: e.target.value }))
            }
          />
        </div>

        <div>
          <FieldLabel htmlFor="txn-notes">Notes</FieldLabel>
          <Textarea
            id="txn-notes"
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </div>

        {error ? <p className="text-body-sm text-error">{error}</p> : null}

        <DialogFooter>
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-error hover:text-error"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit">{isEdit ? "Save" : "Create"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
