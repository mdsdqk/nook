const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, fmt);
  }
  return fmt;
}

export function formatMoney(amount: number, currency = "USD"): string {
  return formatter(currency).format(amount);
}

export function formatSignedMoney(amount: number, currency = "USD"): string {
  const abs = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `-${abs.replace(/^-/, "")}`;
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
  return date.toLocaleDateString("en-US", {
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
  switch (type) {
    case "asset.bank":
      return "Checking";
    case "asset.investment":
      return "Investment";
    case "liability.credit_card":
      return "Credit";
    case "asset.cash":
      return "Cash";
    case "asset.wallet":
      return "Wallet";
    case "liability.loan":
      return "Loan";
    default:
      return type.split(".").pop() ?? type;
  }
}

/** Savings heuristic: bank account whose name mentions savings. */
export function displayAccountKind(
  type: string,
  name: string,
): string {
  if (type === "asset.bank" && /savings/i.test(name)) return "Savings";
  if (type === "asset.bank") return "Checking";
  return accountTypeLabel(type);
}
