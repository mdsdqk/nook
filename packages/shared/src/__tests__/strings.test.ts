import { describe, it, expect } from "vitest";
import { cleanWhitespace } from "../strings";

describe("cleanWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(cleanWhitespace("hello   world")).toBe("hello world");
  });

  it("trims leading/trailing", () => {
    expect(cleanWhitespace("  hello  ")).toBe("hello");
  });

  it("handles tabs and newlines", () => {
    expect(cleanWhitespace("hello\t\nworld")).toBe("hello world");
  });
});
