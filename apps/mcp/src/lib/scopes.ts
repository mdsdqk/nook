import type { AuthUser } from "./convex";

/** OAuth scope intersection — never widen on empty/invalid requested scopes. */

export const SUPPORTED_SCOPES = ["nook.read", "nook.write"] as const;

export type SupportedScope = (typeof SUPPORTED_SCOPES)[number];

export function requireScope(
  user: AuthUser,
  scope: "nook.read" | "nook.write",
): void {
  if (!user.scopes.includes(scope)) {
    throw new Error(`Missing required scope: ${scope}`);
  }
}

/**
 * Intersect requested scopes with a ceiling. Never widens on empty/invalid input.
 * - omitted/empty requested → ceiling
 * - no overlap with ceiling → null (caller should reject)
 */
export function resolveGrantedScopes(
  requested: string | undefined,
  ceiling: readonly string[] = SUPPORTED_SCOPES,
): string[] | null {
  const effectiveCeiling = ceiling.filter((s) =>
    (SUPPORTED_SCOPES as readonly string[]).includes(s),
  );
  const base =
    effectiveCeiling.length > 0 ? effectiveCeiling : [...SUPPORTED_SCOPES];

  if (requested === undefined || requested.trim() === "") {
    return [...base];
  }

  const parts = requested.split(/\s+/).filter(Boolean);
  const granted = parts.filter((s) => base.includes(s));
  if (granted.length === 0) return null;
  return granted;
}
