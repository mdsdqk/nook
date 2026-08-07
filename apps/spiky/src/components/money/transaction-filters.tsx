import { Search } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  MoneyAccount,
  TransactionFilters,
  TransactionTypeFilter,
} from "@/lib/money/types";

const TYPE_CHIPS: { value: TransactionTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfers" },
  { value: "investment", label: "Investments" },
  { value: "debt", label: "Debt" },
];

type TransactionFiltersProps = {
  filters: TransactionFilters;
  onChange: (next: TransactionFilters) => void;
  accounts: MoneyAccount[];
  creditCards: MoneyAccount[];
};

export function TransactionFiltersBar({
  filters,
  onChange,
  accounts,
  creditCards,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-on-surface/40"
          aria-hidden
        />
        <Input
          value={filters.search}
          onChange={(e) =>
            onChange({ ...filters, search: e.target.value })
          }
          placeholder="Search transactions..."
          className="pl-9"
          aria-label="Search transactions"
        />
      </div>

      <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
        {TYPE_CHIPS.map((chip) => {
          const active = filters.type === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onChange({ ...filters, type: chip.value })}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Chip
                variant={active ? "primary" : "default"}
                className={cn(
                  "cursor-pointer transition-colors",
                  active && "bg-primary/20",
                )}
              >
                {chip.label}
              </Chip>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          aria-label="Filter by account"
          className="h-10 w-full text-body-sm sm:h-8 sm:w-auto sm:min-w-[9rem]"
          value={filters.accountId ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              accountId: e.target.value || null,
            })
          }
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by card"
          className="h-10 w-full text-body-sm sm:h-8 sm:w-auto sm:min-w-[9rem]"
          value={filters.cardAccountId ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              cardAccountId: e.target.value || null,
            })
          }
        >
          <option value="">All cards</option>
          {creditCards.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
