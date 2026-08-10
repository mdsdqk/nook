/**
 * Only allow same-origin relative paths under known app prefixes.
 * Blocks open redirects via //evil, /\\evil, protocol-relative, etc.
 */
export function safeReturnTo(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  if (returnTo.includes("\\") || returnTo.includes("@")) return null;

  const pathOnly = returnTo.split(/[?#]/, 2)[0] ?? returnTo;
  const allowed =
    pathOnly === "/dashboard" ||
    pathOnly === "/money" ||
    pathOnly === "/gallery" ||
    pathOnly.startsWith("/oauth/");
  return allowed ? returnTo : null;
}
