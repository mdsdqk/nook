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
});

describe("toISODate", () => {
  it("returns ISO dates as-is", () => {
    expect(toISODate("2026-06-01")).toBe("2026-06-01");
  });

  it("converts Indian dates", () => {
    expect(toISODate("01/06/2026")).toBe("2026-06-01");
  });
});
