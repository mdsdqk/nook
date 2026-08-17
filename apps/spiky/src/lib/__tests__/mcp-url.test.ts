import { describe, expect, it } from "vitest";
import { resolveMcpUrl, isLoopbackHostname } from "../mcp-url";
import {
  isAllowedOauthRedirect,
  isSafeOauthRedirectUri,
} from "../oauth-redirect";

describe("resolveMcpUrl", () => {
  it("rejects missing values", () => {
    expect(resolveMcpUrl(undefined, { isProd: false }).ok).toBe(false);
    expect(resolveMcpUrl("  ", { isProd: false }).ok).toBe(false);
  });

  it("normalizes origin and strips trailing /mcp", () => {
    const a = resolveMcpUrl("https://mcp.example.com/", { isProd: true });
    expect(a).toEqual({
      ok: true,
      origin: "https://mcp.example.com",
      endpoint: "https://mcp.example.com/mcp",
      loopback: false,
    });
    const b = resolveMcpUrl("https://mcp.example.com/mcp", { isProd: true });
    expect(b.ok && b.endpoint).toBe("https://mcp.example.com/mcp");
    expect(b.ok && b.origin).toBe("https://mcp.example.com");
  });

  it("allows http localhost in non-prod", () => {
    const r = resolveMcpUrl("http://127.0.0.1:8787", { isProd: false });
    expect(r.ok && r.endpoint).toBe("http://127.0.0.1:8787/mcp");
    expect(r.ok && r.loopback).toBe(true);
  });

  it("rejects http non-loopback and prod loopback/http", () => {
    expect(resolveMcpUrl("http://evil.example", { isProd: false }).ok).toBe(
      false,
    );
    expect(resolveMcpUrl("http://127.0.0.1:8787", { isProd: true }).ok).toBe(
      false,
    );
    expect(resolveMcpUrl("https://127.0.0.1:8787", { isProd: true }).ok).toBe(
      false,
    );
  });

  it("rejects credentials and bad schemes", () => {
    expect(
      resolveMcpUrl("https://user:pass@mcp.example.com", { isProd: true }).ok,
    ).toBe(false);
    expect(resolveMcpUrl("javascript:alert(1)", { isProd: false }).ok).toBe(
      false,
    );
  });
});

describe("isLoopbackHostname", () => {
  it("detects loopback hosts", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("mcp.example.com")).toBe(false);
  });
});

describe("oauth redirect safety", () => {
  it("allows https and loopback http redirect_uris", () => {
    expect(isSafeOauthRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(
      true,
    );
    expect(isSafeOauthRedirectUri("http://127.0.0.1:1234/callback")).toBe(true);
    expect(isSafeOauthRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isSafeOauthRedirectUri("https://user:x@evil.example/cb")).toBe(
      false,
    );
  });

  it("requires matching origin and path for redirect_to", () => {
    const registered = "https://claude.ai/api/mcp/auth_callback";
    expect(
      isAllowedOauthRedirect(
        `${registered}?code=abc&state=1`,
        registered,
      ),
    ).toBe(true);
    expect(
      isAllowedOauthRedirect("https://evil.example/phish?code=1", registered),
    ).toBe(false);
    expect(
      isAllowedOauthRedirect("https://claude.ai/other?code=1", registered),
    ).toBe(false);
  });
});
