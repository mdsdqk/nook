import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  SUGGESTED_CATEGORIES,
  TRANSACTION_TYPE_REGISTRY,
  TRANSACTION_TYPES,
  type TransactionDirection,
  type TransactionType,
  type TransactionTypeGroup,
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

const GROUP_ORDER: TransactionTypeGroup[] = [
  "income",
  "expense",
  "transfer",
  "investment",
  "debt",
  "tax",
  "insurance",
  "fees",
];

const GROUP_LABELS: Record<TransactionTypeGroup, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  investment: "Investment",
  debt: "Debt",
  tax: "Tax",
  insurance: "Insurance",
  fees: "Fees",
};

const TYPE_OPTIONS_BY_GROUP = GROUP_ORDER.map((group) => ({
  group,
  label: GROUP_LABELS[group],
  types: TRANSACTION_TYPES.filter(
    (type) => TRANSACTION_TYPE_REGISTRY[type].group === group,
  ),
}));

type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: MoneyTransaction | null;
  accounts: MoneyAccount[];
  onSave: (input: TransactionInput) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

function toInput(
  transaction: MoneyTransaction | null | undefined,
  accounts: MoneyAccount[],
): TransactionInput {
  return {
    accountId: transaction?.accountId ?? accounts[0]?.id ?? "",
    date: transaction?.date ?? new Date().toISOString().slice(0, 10),
    direction: transaction?.direction ?? "debit",
    type: transaction?.type ?? "expense",
    amount: transaction?.amount ?? 0,
    description: transaction?.description ?? "",
    narration: transaction?.narration ?? "",
    merchant: transaction?.merchant ?? "",
    category: transaction?.category ?? "",
    notes: transaction?.notes ?? "",
  };
}

const LINKED_EDIT_WARNING =
  "This is a linked transfer. Changing the account, type, direction, or amount will unlink the pair and restore the other transaction. Continue?";

const LINKED_DELETE_WARNING =
  "This is a linked transfer. Deleting it will unlink the other transaction and restore it. Continue?";

function breaksLinkedTransfer(
  original: MoneyTransaction,
  next: TransactionInput,
): boolean {
  if (!original.linkedTransactionId) return false;
  return (
    next.accountId !== original.accountId ||
    next.type !== original.type ||
    next.direction !== original.direction ||
    next.amount !== original.amount
  );
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
  const isLinked = Boolean(transaction?.linkedTransactionId);
  const [form, setForm] = useState<TransactionInput>(() =>
    toInput(transaction, accounts),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(() => {
    const current = form.category?.trim();
    if (current && !(SUGGESTED_CATEGORIES as readonly string[]).includes(current)) {
      return [current, ...SUGGESTED_CATEGORIES];
    }
    return ["", ...SUGGESTED_CATEGORIES];
  }, [form.category]);

  useEffect(() => {
    if (!open) return;
    setForm(toInput(transaction, accounts));
    setError(null);
    setSaving(false);
  }, [open, transaction, accounts]);

  async function handleSubmit(event: FormEvent) {
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
      direction: form.direction,
      type: form.type,
      amount: form.amount,
    };
    const description = form.description?.trim();
    if (description) input.description = description;
    const narration = form.narration?.trim();
    if (narration) input.narration = narration;
    const merchant = form.merchant?.trim();
    if (merchant) input.merchant = merchant;
    // Always send category so "None" can clear an existing value on update.
    input.category = form.category?.trim() ?? "";
    const notes = form.notes?.trim();
    if (notes) input.notes = notes;

    if (transaction && breaksLinkedTransfer(transaction, input)) {
      if (!window.confirm(LINKED_EDIT_WARNING)) return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(input);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit transaction" : "Add transaction"}
      description="Changes are saved to your Convex ledger."
      className="w-[min(100%-2rem,32rem)]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {isLinked ? (
          <p
            className="rounded-md border border-tertiary/30 bg-tertiary/10 px-3 py-2 text-body-sm text-on-surface/80"
            role="status"
          >
            Linked transfer — editing account, type, direction, or amount (or
            deleting) will affect the paired transaction.
          </p>
        ) : null}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="txn-direction">Direction</FieldLabel>
            <Select
              id="txn-direction"
              value={form.direction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  direction: e.target.value as TransactionDirection,
                }))
              }
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
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
            {TYPE_OPTIONS_BY_GROUP.map(({ group, label, types }) => (
              <optgroup key={group} label={label}>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {TRANSACTION_TYPE_REGISTRY[type].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
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
            value={form.category ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            {categoryOptions.map((category) => (
              <option key={category || "__none"} value={category}>
                {category || "None"}
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
              disabled={saving}
              onClick={() => {
                void (async () => {
                  if (isLinked && !window.confirm(LINKED_DELETE_WARNING)) {
                    return;
                  }
                  setSaving(true);
                  setError(null);
                  try {
                    await onDelete();
                    onOpenChange(false);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Delete failed",
                    );
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
