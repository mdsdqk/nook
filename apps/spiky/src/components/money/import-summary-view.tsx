import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatTxnDate,
} from "@/lib/money/format";
import type { StatementImportResult } from "@/lib/money/statement-import";

type ImportSummaryViewProps = {
  results: StatementImportResult[];
};

export function ImportSummaryView({ results }: ImportSummaryViewProps) {
  return (
    <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
      {results.map((result, index) => {
        const key = result.statementId ?? `${result.filename ?? "file"}-${index}`;
        const currency = result.currency ?? DEFAULT_CURRENCY;

        if (!result.ok) {
          return (
            <li
              key={key}
              className="rounded-md border border-error/20 bg-error/5 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <XCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-error"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-white">
                    {result.filename ?? "Statement"}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-body-sm text-error">
                    {(result.errors ?? ["Import failed"]).map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        }

        const warnValidation = result.validationPassed === false;

        return (
          <li
            key={key}
            className="rounded-md border border-white/5 bg-surface-container-highest/40 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              {warnValidation ? (
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-tertiary"
                  aria-hidden
                />
              ) : (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-secondary"
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-body-sm font-medium text-white">
                    {result.bank ?? "Unknown bank"}
                    {result.accountNumberMasked
                      ? ` · ${result.accountNumberMasked}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-label-caps text-on-surface/40">
                    {result.filename}
                    {result.action ? ` · ${result.action}` : ""}
                  </p>
                </div>

                {result.periodStart && result.periodEnd ? (
                  <p className="text-body-sm text-on-surface/70">
                    Period {formatTxnDate(result.periodStart)} –{" "}
                    {formatTxnDate(result.periodEnd)}
                  </p>
                ) : null}

                <p className="text-body-sm text-on-surface/70">
                  {result.transactionCount ?? 0} transaction
                  {(result.transactionCount ?? 0) === 1 ? "" : "s"}
                  {result.openingBalance !== undefined &&
                  result.closingBalance !== undefined
                    ? ` · ${formatMoney(result.openingBalance, currency)} → ${formatMoney(result.closingBalance, currency)}`
                    : ""}
                </p>

                <p className="text-body-sm text-on-surface/60">
                  {result.accountExists
                    ? "Will sync into an existing account"
                    : "A new account will be created on ledger sync"}
                </p>

                {warnValidation ? (
                  <p className="text-body-sm text-tertiary">
                    Validation issues found - ledger sync is disabled for this
                    statement.
                    {result.errors && result.errors.length > 0
                      ? ` ${result.errors.join(" ")}`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
