/**
 * Public MCP origin from Vite env (no trailing slash).
 * Assistants UI must not invent a localhost fallback - unset means misconfigured.
 */

export type McpUrlResolution =
  | {
      ok: true;
      origin: string;
      endpoint: string;
      loopback: boolean;
    }
  | { ok: false; reason: string };

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function isLoopbackMcpOrigin(origin: string): boolean {
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Normalize and validate `VITE_MCP_URL`.
 * - Strips trailing slash and a trailing `/mcp` path segment (common misconfig).
 * - Production builds require https and reject loopback.
 */
export function resolveMcpUrl(
  raw: string | null | undefined,
  options?: { isProd?: boolean },
): McpUrlResolution {
  const isProd = options?.isProd ?? import.meta.env.PROD;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return { ok: false, reason: "VITE_MCP_URL is not set" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "VITE_MCP_URL is not a valid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "VITE_MCP_URL must be http(s)" };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      reason: "VITE_MCP_URL must not include credentials",
    };
  }

  const loopback = isLoopbackHostname(url.hostname);
  if (isProd && url.protocol !== "https:") {
    return {
      ok: false,
      reason: "Production requires an https:// VITE_MCP_URL",
    };
  }
  if (isProd && loopback) {
    return {
      ok: false,
      reason: "Production VITE_MCP_URL cannot be a loopback host",
    };
  }
  if (!isProd && url.protocol === "http:" && !loopback) {
    return {
      ok: false,
      reason: "http:// VITE_MCP_URL is only allowed for localhost",
    };
  }

  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/mcp")) {
    path = path.slice(0, -"/mcp".length);
  }
  if (path === "/") path = "";

  const origin = `${url.origin}${path}`;
  return {
    ok: true,
    origin,
    endpoint: `${origin}/mcp`,
    loopback,
  };
}

export function mcpPublicOrigin(): string | null {
  const resolved = resolveMcpUrl(import.meta.env.VITE_MCP_URL);
  return resolved.ok ? resolved.origin : null;
}

export function mcpEndpointUrl(): string | null {
  const resolved = resolveMcpUrl(import.meta.env.VITE_MCP_URL);
  return resolved.ok ? resolved.endpoint : null;
}

export function mcpUrlConfigError(): string | null {
  const resolved = resolveMcpUrl(import.meta.env.VITE_MCP_URL);
  return resolved.ok ? null : resolved.reason;
}
