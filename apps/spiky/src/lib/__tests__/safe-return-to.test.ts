import { describe, expect, it } from "vitest";
import { safeReturnTo } from "../safe-return-to";

describe("safeReturnTo", () => {
  it("allows oauth consent and known app paths", () => {
    expect(safeReturnTo("/oauth/consent?x=1")).toBe("/oauth/consent?x=1");
    expect(safeReturnTo("/dashboard")).toBe("/dashboard");
    expect(safeReturnTo("/money")).toBe("/money");
  });

  it("rejects open redirects", () => {
    expect(safeReturnTo("//evil.com")).toBeNull();
    expect(safeReturnTo("/\\evil.com")).toBeNull();
    expect(safeReturnTo("https://evil.com")).toBeNull();
    expect(safeReturnTo("/login")).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
  });
});
