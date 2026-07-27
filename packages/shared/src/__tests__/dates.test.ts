import { describe, it, expect } from "vitest";
import { parseIndianDate, toISODate } from "../dates";

describe("parseIndianDate", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseIndianDate("31/12/2025")).toBe("2025-12-31");
  });

  it("parses DD-MM-YYYY", () => {
    expect(parseIndianDate("01-06-2026")).toBe("2026-06-01");
  });

  it("parses DD.MM.YYYY", () => {
    expect(parseIndianDate("15.03.2026")).toBe("2026-03-15");
  });

  it("pads single-digit day/month", () => {
    expect(parseIndianDate("1/6/2026")).toBe("2026-06-01");
  });

  it("throws on invalid format", () => {
    expect(() => parseIndianDate("2026-01-01")).toThrow();
  });

  it("parses DD MMM YYYY", () => {
    expect(parseIndianDate("27 Apr 2026")).toBe("2026-04-27");
    expect(parseIndianDate("1 Jul 2026")).toBe("2026-07-01");
    expect(parseIndianDate("26 Jul 2026")).toBe("2026-07-26");
  });

  it("parses DD-MMM-YYYY", () => {
    expect(parseIndianDate("01-Jun-2026")).toBe("2026-06-01");
    expect(parseIndianDate("30-Jun-2026")).toBe("2026-06-30");
  });

  it("throws on unknown month abbreviation", () => {
    expect(() => parseIndianDate("01 Foo 2026")).toThrow();
  });
});

describe("toISODate", () => {
  it("returns ISO dates as-is", () => {
    expect(toISODate("2026-06-01")).toBe("2026-06-01");
  });

  it("converts Indian dates", () => {
    expect(toISODate("01/06/2026")).toBe("2026-06-01");
  });

  it("converts textual Indian dates", () => {
    expect(toISODate("27 Apr 2026")).toBe("2026-04-27");
  });

  it("converts hyphenated textual Indian dates", () => {
    expect(toISODate("01-Jun-2026")).toBe("2026-06-01");
  });
});
