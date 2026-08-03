function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function originFor(protocol: string, hostname: string, port: string): string {
  const host =
    hostname.includes(":") && !hostname.startsWith("[")
      ? `[${hostname}]`
      : hostname;
  const authority = port ? `${host}:${port}` : host;
  return new URL(`${protocol}//${authority}`).origin;
}

/**
 * Build Better Auth `trustedOrigins` from SITE_URL plus optional TRUSTED_ORIGINS CSV.
 * Loopback SITE_URL expands to localhost / 127.0.0.1 / [::1] on the same port.
 */
export function buildTrustedOrigins(
  siteUrl: string,
  extraOriginsCsv?: string,
): string[] {
  const allowed = new Set<string>();
  const primary = new URL(siteUrl);

  if (isLoopbackHostname(primary.hostname)) {
    for (const host of ["localhost", "127.0.0.1", "::1"]) {
      allowed.add(originFor(primary.protocol, host, primary.port));
    }
  } else {
    allowed.add(primary.origin);
  }

  if (extraOriginsCsv) {
    for (const part of extraOriginsCsv.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        allowed.add(new URL(trimmed).origin);
      } catch {
        // ignore malformed entries
      }
    }
  }

  return [...allowed];
}
