import { describe, expect, it } from "vitest";
import { sanitizeAppPath } from "../safe-path";

describe("sanitizeAppPath", () => {
  it("keeps safe relative paths", () => {
    expect(sanitizeAppPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeAppPath("/cli-auth?port=1&state=abc")).toBe(
      "/cli-auth?port=1&state=abc",
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeAppPath("https://evil.example/phish")).toBe("/dashboard");
    expect(sanitizeAppPath("//evil.example/phish")).toBe("/dashboard");
    expect(sanitizeAppPath("http://localhost:5174/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects missing or non-path values", () => {
    expect(sanitizeAppPath(null)).toBe("/dashboard");
    expect(sanitizeAppPath("dashboard")).toBe("/dashboard");
    expect(sanitizeAppPath("/\\evil")).toBe("/dashboard");
    expect(sanitizeAppPath("/ok\n/evil")).toBe("/dashboard");
  });

  it("supports a custom fallback", () => {
    expect(sanitizeAppPath("//x", "/login")).toBe("/login");
  });
});
