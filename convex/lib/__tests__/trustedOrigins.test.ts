import { describe, expect, test } from "bun:test";
import { buildTrustedOrigins } from "../trustedOrigins";

describe("buildTrustedOrigins", () => {
  test("expands loopback SITE_URL", () => {
    const origins = buildTrustedOrigins("http://localhost:5174");
    expect(origins).toContain("http://localhost:5174");
    expect(origins).toContain("http://127.0.0.1:5174");
    expect(origins).toContain("http://[::1]:5174");
  });

  test("merges TRUSTED_ORIGINS CSV", () => {
    const origins = buildTrustedOrigins(
      "http://localhost:5174",
      "http://192.168.1.20:5174",
    );
    expect(origins).toContain("http://192.168.1.20:5174");
  });

  test("keeps production origin exact", () => {
    expect(buildTrustedOrigins("https://app.example.com")).toEqual([
      "https://app.example.com",
    ]);
  });
});
