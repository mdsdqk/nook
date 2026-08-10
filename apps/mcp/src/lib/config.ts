import { randomBytes } from "node:crypto";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

let ephemeralConsentSecret: string | null = null;

function resolveConsentSecret(): string {
  const fromEnv = process.env["MCP_CONSENT_SECRET"];
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (!ephemeralConsentSecret) {
    console.warn(
      "MCP_CONSENT_SECRET not set; using ephemeral in-memory secret (dev only)",
    );
    ephemeralConsentSecret = randomBytes(32).toString("hex");
  }
  return ephemeralConsentSecret;
}

export const config = {
  port: Number(optional("PORT", "8787")),
  mcpPublicUrl: optional("MCP_PUBLIC_URL", "http://127.0.0.1:8787").replace(
    /\/$/,
    "",
  ),
  authUiPublicUrl: optional(
    "AUTH_UI_PUBLIC_URL",
    "http://127.0.0.1:5174",
  ).replace(/\/$/, ""),
  convexUrl: () => required("CONVEX_URL"),
  /** Better Auth HTTP site (`.convex.site`) — used to exchange Spiky session tokens. */
  convexSiteUrl: () => {
    const fromEnv = process.env["CONVEX_SITE_URL"]?.replace(/\/$/, "");
    if (fromEnv) return fromEnv;
    const cloud = process.env["CONVEX_URL"];
    if (cloud) {
      return cloud.replace(/\.cloud\/?$/, ".site").replace(/\/$/, "");
    }
    throw new Error("CONVEX_SITE_URL or CONVEX_URL environment variable is required");
  },
  maxUploadBytes: Number(
    optional("MCP_MAX_UPLOAD_BYTES", String(15 * 1024 * 1024)),
  ),
  accessTokenTtlSec: Number(optional("MCP_ACCESS_TOKEN_TTL_SEC", "3600")),
  refreshTokenTtlSec: Number(
    optional("MCP_REFRESH_TOKEN_TTL_SEC", String(30 * 24 * 3600)),
  ),
  authCodeTtlSec: Number(optional("MCP_AUTH_CODE_TTL_SEC", "600")),
  consentTicketTtlSec: Number(optional("MCP_CONSENT_TICKET_TTL_SEC", "600")),
  /** Optional. When set, DCR requires Authorization: Bearer <secret>. */
  dcrSharedSecret: process.env["MCP_DCR_SHARED_SECRET"] ?? null,
  allowInsecureLocalhostRedirects:
    optional("MCP_ALLOW_LOCALHOST_REDIRECTS", "true") === "true",
  rateLimitWindowMs: Number(optional("MCP_RATE_LIMIT_WINDOW_MS", "60000")),
  rateLimitMax: Number(optional("MCP_RATE_LIMIT_MAX", "60")),
  consentSecret: resolveConsentSecret,
};

export function mcpResourceUrl(): string {
  return `${config.mcpPublicUrl}/mcp`;
}

export function authUiOrigin(): string {
  return new URL(config.authUiPublicUrl).origin;
}
