import { useEffect, useState, type FormEvent } from "react";
import type { AccountType } from "@nook/domain";
import { ACCOUNT_TYPE_REGISTRY } from "@nook/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogFooter,
  FieldLabel,
  Select,
} from "@/components/ui/dialog";
import type { AccountInput, MoneyAccount } from "@/lib/money/types";

const ACCOUNT_TYPE_OPTIONS = (
  Object.keys(ACCOUNT_TYPE_REGISTRY) as AccountType[]
).filter((type) => ACCOUNT_TYPE_REGISTRY[type].parent !== null);

type AccountFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: MoneyAccount | null;
  onSave: (input: AccountInput) => void;
  onDelete?: () => void;
};

function toInput(account?: MoneyAccount | null): AccountInput {
  return {
    name: account?.name ?? "",
    type: account?.type ?? "asset.bank",
    institution: account?.institution ?? "",
    accountNumberMasked: account?.accountNumberMasked ?? "",
    currency: account?.currency ?? "USD",
    balance: account?.balance ?? 0,
  };
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSave,
  onDelete,
}: AccountFormDialogProps) {
  const isEdit = Boolean(account);
  const [form, setForm] = useState<AccountInput>(() => toInput(account));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toInput(account));
    setError(null);
  }, [open, account]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    const input: AccountInput = {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency,
      balance: form.balance,
    };
    const institution = form.institution?.trim();
    if (institution) input.institution = institution;
    const masked = form.accountNumberMasked?.trim();
    if (masked) input.accountNumberMasked = masked;
    onSave(input);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit account" : "Add account"}
      description="Balances update locally in this spike."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <FieldLabel htmlFor="acct-name">Name</FieldLabel>
          <Input
            id="acct-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <FieldLabel htmlFor="acct-type">Type</FieldLabel>
          <Select
            id="acct-type"
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as AccountType,
              }))
            }
          >
            {ACCOUNT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_REGISTRY[type].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="acct-institution">Institution</FieldLabel>
          <Input
            id="acct-institution"
            value={form.institution ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, institution: e.target.value }))
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="acct-masked">Masked number</FieldLabel>
          <Input
            id="acct-masked"
            value={form.accountNumberMasked ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                accountNumberMasked: e.target.value,
              }))
            }
            placeholder=".... 1234"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="acct-currency">Currency</FieldLabel>
            <Input
              id="acct-currency"
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value }))
              }
            />
          </div>
          <div>
            <FieldLabel htmlFor="acct-balance">Balance</FieldLabel>
            <Input
              id="acct-balance"
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  balance: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
        {error ? <p className="text-body-sm text-error">{error}</p> : null}
        <DialogFooter>
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-error hover:text-error"
              onClick={() => {
                try {
                  onDelete();
                  onOpenChange(false);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Delete failed",
                  );
                }
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
