import { randomBytes } from "node:crypto";
import type { NookCredentials } from "./convex-auth";

export function createLoginState(): string {
  return randomBytes(24).toString("base64url");
}

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
 * Build the Origin allowlist for the CLI callback server.
 * Loopback primary URLs expand to localhost / 127.0.0.1 / [::1] on the same port.
 * `extraOriginsCsv` adds exact origins (e.g. LAN test machines).
 */
export function buildCallbackAllowedOrigins(
  primarySpikyUrl: string,
  extraOriginsCsv?: string,
): string[] {
  const allowed = new Set<string>();
  const primary = new URL(primarySpikyUrl);

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

export function isAllowedCallbackOrigin(
  originHeader: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!originHeader) return false;
  try {
    const actual = new URL(originHeader).origin;
    return allowedOrigins.includes(actual);
  } catch {
    return false;
  }
}

export function parseCallbackPayload(
  body: unknown,
  expectedState: string,
): NookCredentials {
  if (!body || typeof body !== "object") {
    throw new Error("Expected JSON object");
  }
  const record = body as Record<string, unknown>;
  if (record.state !== expectedState) {
    throw new Error("Invalid login state");
  }
  if (
    typeof record.sessionToken !== "string" ||
    typeof record.convexUrl !== "string" ||
    typeof record.convexSiteUrl !== "string" ||
    typeof record.obtainedAt !== "string"
  ) {
    throw new Error("Missing credential fields");
  }
  if (!record.sessionToken || !record.convexUrl || !record.convexSiteUrl) {
    throw new Error("Empty credential fields");
  }
  return {
    sessionToken: record.sessionToken,
    convexUrl: record.convexUrl,
    convexSiteUrl: record.convexSiteUrl,
    obtainedAt: record.obtainedAt,
  };
}
