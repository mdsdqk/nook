import type { ResultWriter, ParseResult } from "@nook/contracts";
import {
  buildExternalKey,
  maskAccountNumber,
  buildAccountFingerprint,
} from "./external-key";

export interface ConvexWritePayload {
  bank: string;
  accountFingerprint: string;
  accountNumberMasked: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  transactionCount: number;
  contentHash: string;
  sourcePath: string;
  transactions: Array<{
    sequence: number;
    date: string;
    narration: string;
    debit?: number;
    credit?: number;
    balance: number;
    reference: string;
    externalKey: string;
  }>;
}

/**
 * Build the Convex upsert payload from a successful ParseResult.
 * Shared by CLI writer and Spiky Convex import action.
 */
export function buildConvexWritePayload(
  result: ParseResult,
): ConvexWritePayload {
  if (!result.statement) {
    throw new Error("Cannot write: no parsed statement");
  }

  const stmt = result.statement;
  const accountFingerprint = buildAccountFingerprint(
    stmt.metadata.bank,
    stmt.metadata.accountNumber,
  );
  const accountNumberMasked = maskAccountNumber(stmt.metadata.accountNumber);

  const transactions = stmt.transactions.map((txn) => ({
    sequence: txn.sequence,
    date: txn.date,
    narration: txn.narration,
    ...(txn.debit != null ? { debit: txn.debit } : {}),
    ...(txn.credit != null ? { credit: txn.credit } : {}),
    balance: txn.balance,
    reference: txn.reference,
    externalKey: buildExternalKey(
      stmt.metadata.bank,
      accountFingerprint,
      txn,
    ),
  }));

  return {
    bank: stmt.metadata.bank,
    accountFingerprint,
    accountNumberMasked,
    currency: stmt.metadata.currency,
    periodStart: stmt.metadata.statementPeriod.from,
    periodEnd: stmt.metadata.statementPeriod.to,
    openingBalance: stmt.openingBalance,
    closingBalance: stmt.closingBalance,
    transactionCount: stmt.transactions.length,
    contentHash: result.source.contentHash,
    sourcePath: result.source.path,
    transactions,
  };
}

/**
 * Convex statement writer.
 *
 * Prepares the upsert payload from a ParseResult. The actual Convex
 * mutation call is done by the caller (CLI) since the Convex client
 * requires a deployment URL that's configured at the app level.
 */
export class ConvexStatementWriter implements ResultWriter {
  private onWrite: (payload: ConvexWritePayload) => Promise<void>;

  constructor(onWrite: (payload: ConvexWritePayload) => Promise<void>) {
    this.onWrite = onWrite;
  }

  async write(result: ParseResult): Promise<void> {
    await this.onWrite(buildConvexWritePayload(result));
  }
}
