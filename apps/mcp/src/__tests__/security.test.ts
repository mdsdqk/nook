import { describe, expect, it } from "vitest";
import {
  signConsentTicket,
  verifyConsentTicket,
  pkceS256Challenge,
  timingSafeEqualStr,
} from "../lib/crypto";
import { assertSafeFileUrl } from "../lib/ssrf";

describe("consent tickets", () => {
  const secret = "test-consent-secret-at-least-16";

  it("round-trips a valid ticket", () => {
    const ticket = signConsentTicket(
      {
        client_id: "client",
        redirect_uri: "https://app.example/cb",
        code_challenge: "abc",
        code_challenge_method: "S256",
        exp: Date.now() + 60_000,
      },
      secret,
    );
    const payload = verifyConsentTicket(ticket, secret);
    expect(payload?.client_id).toBe("client");
    expect(payload?.redirect_uri).toBe("https://app.example/cb");
  });

  it("rejects tampered tickets", () => {
    const ticket = signConsentTicket(
      {
        client_id: "client",
        redirect_uri: "https://app.example/cb",
        code_challenge: "abc",
        code_challenge_method: "S256",
        exp: Date.now() + 60_000,
      },
      secret,
    );
    const [body] = ticket.split(".");
    expect(verifyConsentTicket(`${body}.deadbeef`, secret)).toBeNull();
  });

  it("rejects expired tickets", () => {
    const ticket = signConsentTicket(
      {
        client_id: "client",
        redirect_uri: "https://app.example/cb",
        code_challenge: "abc",
        code_challenge_method: "S256",
        exp: Date.now() - 1,
      },
      secret,
    );
    expect(verifyConsentTicket(ticket, secret)).toBeNull();
  });
});

describe("PKCE S256", () => {
  it("matches RFC 7636 example shape", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = pkceS256Challenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("timingSafeEqualStr distinguishes unequal", () => {
    expect(timingSafeEqualStr("abc", "abc")).toBe(true);
    expect(timingSafeEqualStr("abc", "abd")).toBe(false);
    expect(timingSafeEqualStr("abc", "ab")).toBe(false);
  });
});

describe("SSRF fileUrl guard", () => {
  it("allows public https hosts", () => {
    expect(assertSafeFileUrl("https://cdn.example.com/stmt.pdf").hostname).toBe(
      "cdn.example.com",
    );
  });

  it("blocks localhost and private IPs", () => {
    expect(() => assertSafeFileUrl("http://127.0.0.1/x")).toThrow(/not allowed|private/i);
    expect(() => assertSafeFileUrl("http://localhost/x")).toThrow(/not allowed/i);
    expect(() => assertSafeFileUrl("http://10.0.0.5/x")).toThrow(/private/i);
    expect(() => assertSafeFileUrl("http://192.168.1.1/x")).toThrow(/private/i);
    expect(() => assertSafeFileUrl("http://169.254.169.254/latest")).toThrow(
      /private/i,
    );
  });

  it("blocks non-http schemes", () => {
    expect(() => assertSafeFileUrl("file:///etc/passwd")).toThrow(/http/i);
  });
});
