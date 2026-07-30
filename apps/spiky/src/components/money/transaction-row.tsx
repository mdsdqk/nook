import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
} from "lucide-react";
import { isTransferType } from "@nook/domain";
import { Chip } from "@/components/ui/chip";
import {
  formatTxnDate,
  initialsFromLabel,
  signedTransactionAmount,
  formatSignedMoney,
  DEFAULT_CURRENCY,
} from "@/lib/money/format";
import type { MoneyAccount, MoneyTransaction } from "@/lib/money/types";
import { cn } from "@/lib/utils";

type TransactionRowProps = {
  transaction: MoneyTransaction;
  account?: MoneyAccount;
  onClick: () => void;
};

export function TransactionRow({
  transaction,
  account,
  onClick,
}: TransactionRowProps) {
  const label =
    transaction.merchant ||
    transaction.description ||
    transaction.narration ||
    "Transaction";
  const signed = signedTransactionAmount(
    transaction.direction,
    transaction.amount,
  );
  const isCredit = transaction.direction === "credit";
  const isTransfer = isTransferType(transaction.type);

  const directionLabel = isTransfer
    ? transaction.transferRole === "in"
      ? "transfer in"
      : "transfer out"
    : isCredit
      ? "credit"
      : "debit";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-white/5 px-1 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-label-caps text-on-surface">
        {initialsFromLabel(label)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-medium text-white">
          {transaction.description || label}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          {transaction.category ? (
            <Chip variant="outline" className="text-[10px]">
              {transaction.category}
            </Chip>
          ) : null}
          {account ? (
            <span className="text-label-caps text-on-surface/40">
              {account.name}
            </span>
          ) : null}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block font-mono text-body-sm font-medium",
            isCredit ? "text-secondary" : "text-white",
          )}
        >
          {formatSignedMoney(signed, account?.currency ?? DEFAULT_CURRENCY)}
        </span>
        <span className="mt-0.5 block text-label-caps text-on-surface/40">
          {formatTxnDate(transaction.date)}
        </span>
      </span>

      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isTransfer
            ? "bg-tertiary/10 text-tertiary"
            : isCredit
              ? "bg-secondary/10 text-secondary"
              : "bg-error/10 text-error",
        )}
        aria-label={directionLabel}
      >
        {isTransfer ? (
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
        ) : isCredit ? (
          <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        )}
      </span>
    </button>
  );
}
