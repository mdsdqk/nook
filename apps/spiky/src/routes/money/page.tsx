import { useState } from "react";
import { AccountsSection } from "@/components/money/accounts-section";
import { CashFlowSection } from "@/components/money/cash-flow-section";
import { MoneyEmptyState } from "@/components/money/money-empty-state";
import { MoneySkeletons } from "@/components/money/money-skeletons";
import { SyncPendingBanner } from "@/components/money/sync-pending-banner";
import { AccountFormDialog } from "@/components/money/account-form-dialog";
import { TransactionsSection } from "@/components/money/transactions-section";
import { useMoney } from "@/lib/money/use-money";
import type { TransactionFilters } from "@/lib/money/types";

export function MoneyPage() {
  const [filters, setFilters] = useState<TransactionFilters>({
    type: "all",
    accountId: null,
    cardAccountId: null,
    search: "",
  });
  const [createOpen, setCreateOpen] = useState(false);

  const money = useMoney(filters);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-white/5 px-container">
        <h1 className="text-title-md font-medium text-white">Money</h1>
      </header>

      <main className="flex flex-1 flex-col gap-stack-lg overflow-y-auto px-container py-stack-md">
        {money.isLoading ? (
          <MoneySkeletons />
        ) : money.isEmpty ? (
          <>
            <MoneyEmptyState
              hasUnsynced={money.hasUnsynced}
              unsyncedCount={money.unsyncedStatements.length}
              syncPending={money.syncPending}
              syncError={money.syncError}
              onAddAccount={() => setCreateOpen(true)}
              onSync={() => {
                void money.syncPendingStatements();
              }}
            />
            <AccountFormDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              onSave={async (input) => {
                await money.createAccount(input);
              }}
            />
          </>
        ) : (
          <>
            {money.hasUnsynced ? (
              <SyncPendingBanner
                count={money.unsyncedStatements.length}
                syncPending={money.syncPending}
                syncError={money.syncError}
                onSync={() => {
                  void money.syncPendingStatements();
                }}
              />
            ) : null}

            <AccountsSection
              accounts={money.accounts}
              totalBalance={money.totalBalance}
              onCreate={money.createAccount}
              onUpdate={(id, input) => money.updateAccount(id, input)}
              onDelete={money.deleteAccount}
            />

            <CashFlowSection series={money.cashFlow} />

            <TransactionsSection
              accounts={money.accounts}
              creditCards={money.creditCards}
              transactions={money.filteredTransactions}
              filters={filters}
              onFiltersChange={setFilters}
              onCreate={money.createTransaction}
              onUpdate={(id, input) => money.updateTransaction(id, input)}
              onDelete={money.deleteTransaction}
            />
          </>
        )}
      </main>
    </>
  );
}
