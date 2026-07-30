/**
 * Transfer matching helpers live in `@nook/domain` so they are unit-testable.
 * This module re-exports them for Convex call sites.
 */
export {
  TRANSFER_MATCH_DATE_WINDOW_DAYS,
  canBeTransferIn,
  canBeTransferOut,
  dateDiffDays,
  matchTransferPairs,
  type MatchableTransaction,
  type TransferMatchPair,
  type TransferRole,
} from "@nook/domain";
