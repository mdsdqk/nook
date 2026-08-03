import { describe, expect, test } from "bun:test";
import {
  buildCallbackAllowedOrigins,
  isAllowedCallbackOrigin,
  parseCallbackPayload,
} from "../auth-callback";

describe("CLI auth callback validation", () => {
  test("accepts matching Spiky origin", () => {
    const allowed = buildCallbackAllowedOrigins("http://localhost:5174");
    expect(
      isAllowedCallbackOrigin("http://localhost:5174", allowed),
    ).toBe(true);
    expect(
      isAllowedCallbackOrigin("http://localhost:5174/", allowed),
    ).toBe(true);
  });

  test("treats loopback hosts as equivalent on the same port", () => {
    const fromLocalhost = buildCallbackAllowedOrigins("http://localhost:5174");
    expect(
      isAllowedCallbackOrigin("http://127.0.0.1:5174", fromLocalhost),
    ).toBe(true);
    expect(isAllowedCallbackOrigin("http://[::1]:5174", fromLocalhost)).toBe(
      true,
    );

    const fromIp = buildCallbackAllowedOrigins("http://127.0.0.1:5174");
    expect(isAllowedCallbackOrigin("http://localhost:5174", fromIp)).toBe(true);
  });

  test("does not expand loopback across ports or to foreign hosts", () => {
    const allowed = buildCallbackAllowedOrigins("http://localhost:5174");
    expect(isAllowedCallbackOrigin("http://localhost:3000", allowed)).toBe(
      false,
    );
    expect(
      isAllowedCallbackOrigin("https://evil.example", allowed),
    ).toBe(false);
    expect(isAllowedCallbackOrigin(undefined, allowed)).toBe(false);
  });

  test("includes exact extra origins from CSV", () => {
    const allowed = buildCallbackAllowedOrigins(
      "http://localhost:5174",
      "http://192.168.1.20:5174, https://evil.example ",
    );
    expect(
      isAllowedCallbackOrigin("http://192.168.1.20:5174", allowed),
    ).toBe(true);
    expect(isAllowedCallbackOrigin("https://evil.example", allowed)).toBe(true);
    expect(
      isAllowedCallbackOrigin("http://10.0.0.1:5174", allowed),
    ).toBe(false);
  });

  test("production primary stays exact without loopback expansion", () => {
    const allowed = buildCallbackAllowedOrigins("https://app.example.com");
    expect(isAllowedCallbackOrigin("https://app.example.com", allowed)).toBe(
      true,
    );
    expect(isAllowedCallbackOrigin("http://localhost:5174", allowed)).toBe(
      false,
    );
  });

  test("requires matching state and credential fields", () => {
    const state = "test-state";
    const ok = parseCallbackPayload(
      {
        state,
        sessionToken: "sess",
        convexUrl: "https://x.convex.cloud",
        convexSiteUrl: "https://x.convex.site",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      },
      state,
    );
    expect(ok.sessionToken).toBe("sess");

    expect(() =>
      parseCallbackPayload(
        {
          state: "other",
          sessionToken: "sess",
          convexUrl: "https://x.convex.cloud",
          convexSiteUrl: "https://x.convex.site",
          obtainedAt: "2026-01-01T00:00:00.000Z",
        },
        state,
      ),
    ).toThrow("Invalid login state");

    expect(() =>
      parseCallbackPayload(
        {
          state,
          sessionToken: "",
          convexUrl: "https://x.convex.cloud",
          convexSiteUrl: "https://x.convex.site",
          obtainedAt: "2026-01-01T00:00:00.000Z",
        },
        state,
      ),
    ).toThrow("Empty credential fields");
  });
});
