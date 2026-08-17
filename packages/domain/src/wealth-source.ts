/**
 * Provenance of wealth evidence / asset transactions.
 * Priority is for reconciliation logic only - never persisted on rows.
 *
 * Order (highest first): broker_api > broker_statement > cas > manual
 */
export type WealthSourceType =
  | "broker_api"
  | "broker_statement"
  | "cas"
  | "manual";

const WEALTH_SOURCE_PRIORITY: Record<WealthSourceType, number> = {
  broker_api: 4,
  broker_statement: 3,
  cas: 2,
  manual: 1,
};

export const WEALTH_SOURCE_TYPES = Object.keys(
  WEALTH_SOURCE_PRIORITY,
) as WealthSourceType[];

export function isWealthSourceType(value: string): value is WealthSourceType {
  return value in WEALTH_SOURCE_PRIORITY;
}

/** Positive if `a` outranks `b`; negative if `b` outranks `a`; 0 if equal. */
export function compareWealthSourcePriority(
  a: WealthSourceType,
  b: WealthSourceType,
): number {
  return WEALTH_SOURCE_PRIORITY[a] - WEALTH_SOURCE_PRIORITY[b];
}
