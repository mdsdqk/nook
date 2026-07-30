import {
  Wallet,
  PiggyBank,
  LineChart,
  CreditCard,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { isBankAccountType } from "@nook/domain";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import {
  displayAccountKind,
  formatMoney,
} from "@/lib/money/format";
import type { MoneyAccount } from "@/lib/money/types";

function iconForAccount(account: MoneyAccount): {
  Icon: LucideIcon;
  tone: string;
} {
  if (account.type === "liability.credit_card") {
    return { Icon: CreditCard, tone: "bg-error/15 text-error" };
  }
  if (account.type === "asset.investment") {
    return { Icon: LineChart, tone: "bg-secondary/15 text-secondary" };
  }
  if (account.type === "asset.bank.savings") {
    return { Icon: PiggyBank, tone: "bg-tertiary/15 text-tertiary" };
  }
  if (
    account.type === "asset.bank.current" ||
    isBankAccountType(account.type)
  ) {
    return { Icon: Building2, tone: "bg-primary/15 text-primary" };
  }
  return { Icon: Wallet, tone: "bg-primary/15 text-primary" };
}

type AccountCardProps = {
  account: MoneyAccount;
  onClick: () => void;
};

export function AccountCard({ account, onClick }: AccountCardProps) {
  const { Icon, tone } = iconForAccount(account);
  const kind = displayAccountKind(account.type);
  const isNegative = account.balance < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-1 flex min-w-[220px] flex-1 flex-col gap-3 rounded-lg p-4 text-left transition-all duration-200",
        "hover:glass-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            tone,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <Chip variant="outline" className="text-[10px]">
          {kind}
        </Chip>
      </div>
      <div>
        <p
          className={cn(
            "font-mono text-title-md font-medium tracking-tight",
            isNegative ? "text-error" : "text-white",
          )}
        >
          {formatMoney(account.balance, account.currency)}
        </p>
        <p className="mt-1 truncate text-body-sm text-on-surface/80">
          {account.name}
        </p>
        {account.accountNumberMasked ? (
          <p className="mt-0.5 font-mono text-label-caps text-on-surface/40">
            {account.accountNumberMasked}
          </p>
        ) : null}
      </div>
    </button>
  );
}
