import type { ParsedTransaction } from "@nook/contracts";
import { createHash } from "node:crypto";

/**
 * Build a stable external key for deduplication.
 * Prefer bank reference when available; fall back to positional key.
 */
export function buildExternalKey(
  bank: string,
  accountFingerprint: string,
  txn: ParsedTransaction,
): string {
  const ref = txn.reference.replace(/^0+$/, "");
  if (ref.length > 0) {
    return `${bank}|${accountFingerprint}|${ref}`;
  }
  const amount = txn.debit ?? txn.credit ?? 0;
  return `${bank}|${accountFingerprint}|${txn.date}|${amount}|${txn.sequence}`;
}

/**
 * Mask account number: keep last 4 digits.
 */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return "XXXX" + accountNumber.slice(-4);
}

/**
 * Build account fingerprint from bank + hashed account number.
 * Uses a short stable hash to reduce collision risk while avoiding raw account storage.
 */
export function buildAccountFingerprint(
  bank: string,
  accountNumber: string,
): string {
  const normalized = `${bank.toLowerCase()}|${accountNumber.trim()}`;
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `${bank.toLowerCase()}-${digest}`;
}
