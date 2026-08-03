/**
 * Allow only same-app relative paths for post-login redirects / OAuth callbackURL.
 * Rejects protocol-relative URLs, absolute URLs, and backslash tricks.
 */
export function sanitizeAppPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.includes("\n") || value.includes("\r")) return fallback;
  return value;
}
