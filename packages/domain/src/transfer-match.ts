export type TransferRole = "out" | "in";

export const TRANSFER_MATCH_DATE_WINDOW_DAYS = 3;

/** Minimal transaction shape needed to propose transfer pairs. */
export type MatchableTransaction = {
  id: string;
  accountId: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  transferRole?: TransferRole;
  linkedTransactionId?: string;
};

export type TransferMatchPair = {
  outId: string;
  inId: string;
};

export function dateDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay!, am! - 1, ad!);
  const bMs = Date.UTC(by!, bm! - 1, bd!);
  return Math.round((aMs - bMs) / (24 * 60 * 60 * 1000));
}

export function canBeTransferOut(txn: MatchableTransaction): boolean {
  if (txn.linkedTransactionId) return false;
  if (txn.type === "expense") return true;
  if (txn.type === "transfer" && txn.transferRole !== "in") return true;
  return false;
}

export function canBeTransferIn(txn: MatchableTransaction): boolean {
  if (txn.linkedTransactionId) return false;
  if (txn.type === "income") return true;
  if (txn.type === "transfer" && txn.transferRole !== "out") return true;
  return false;
}

/**
 * Greedily match opposite-direction legs across accounts.
 * Prefers the smallest absolute date gap, then stable id order.
 * Each transaction is used at most once.
 */
export function matchTransferPairs(
  transactions: MatchableTransaction[],
  dateWindowDays = TRANSFER_MATCH_DATE_WINDOW_DAYS,
): TransferMatchPair[] {
  const outs = transactions.filter(canBeTransferOut);
  const ins = transactions.filter(canBeTransferIn);

  type Edge = {
    outId: string;
    inId: string;
    gap: number;
  };

  const edges: Edge[] = [];

  for (const out of outs) {
    for (const inn of ins) {
      if (out.id === inn.id) continue;
      if (out.accountId === inn.accountId) continue;
      if (out.amount !== inn.amount) continue;
      if (out.currency !== inn.currency) continue;
      const gap = Math.abs(dateDiffDays(out.date, inn.date));
      if (gap > dateWindowDays) continue;
      edges.push({ outId: out.id, inId: inn.id, gap });
    }
  }

  edges.sort((a, b) => {
    if (a.gap !== b.gap) return a.gap - b.gap;
    const byOut = a.outId.localeCompare(b.outId);
    if (byOut !== 0) return byOut;
    return a.inId.localeCompare(b.inId);
  });

  const used = new Set<string>();
  const pairs: TransferMatchPair[] = [];

  for (const edge of edges) {
    if (used.has(edge.outId) || used.has(edge.inId)) continue;
    used.add(edge.outId);
    used.add(edge.inId);
    pairs.push({ outId: edge.outId, inId: edge.inId });
  }

  return pairs;
}
