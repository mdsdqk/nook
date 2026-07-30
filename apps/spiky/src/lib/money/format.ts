import { getAccountTypeLabel } from "@nook/domain";

export const DEFAULT_CURRENCY = "INR";
export const CURRENCY_LOCALE = "en-IN";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(CURRENCY_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, fmt);
  }
  return fmt;
}

export function formatMoney(
  amount: number,
  currency = DEFAULT_CURRENCY,
): string {
  return formatter(currency).format(amount);
}

export function formatSignedMoney(
  amount: number,
  currency = DEFAULT_CURRENCY,
): string {
  const abs = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${abs}`;
  if (amount < 0) {
    // en-IN already prefixes ₹; keep a leading minus for signed display.
    return `-${abs.replace(/^-/, "")}`;
  }
  return abs;
}

/** Display amount for a ledger transaction: income positive, expense/transfer negative. */
export function signedTransactionAmount(
  type: string,
  amount: number,
): number {
  if (type === "income") return amount;
  return -Math.abs(amount);
}

export function formatTxnDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString(CURRENCY_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function accountTypeLabel(type: string): string {
  return getAccountTypeLabel(type);
}

/** Display chip label from the domain registry (no name heuristics). */
export function displayAccountKind(type: string): string {
  return getAccountTypeLabel(type);
}
