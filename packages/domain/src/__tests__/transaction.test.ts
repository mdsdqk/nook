import { describe, it, expect } from "vitest";
import {
  type TransactionType,
  TRANSACTION_TYPE_REGISTRY,
  requiresDestinationAccount,
} from "../transaction";

const ALL_TYPES = Object.keys(TRANSACTION_TYPE_REGISTRY) as TransactionType[];

describe("TRANSACTION_TYPE_REGISTRY", () => {
  it("has an entry for every TransactionType union member", () => {
    const expected: TransactionType[] = [
      "income",
      "expense",
      "transfer",
      "obligation",
    ];
    expect(ALL_TYPES.sort()).toEqual(expected.sort());
  });

  it("every entry has required metadata fields", () => {
    for (const type of ALL_TYPES) {
      const meta = TRANSACTION_TYPE_REGISTRY[type];
      expect(meta).toHaveProperty("label");
      expect(meta).toHaveProperty("direction");
      expect(meta).toHaveProperty("affectsNetWorth");
      expect(typeof meta.label).toBe("string");
      expect(["in", "out", "internal"]).toContain(meta.direction);
      expect(typeof meta.affectsNetWorth).toBe("boolean");
    }
  });

  it("income flows in and affects net worth", () => {
    const meta = TRANSACTION_TYPE_REGISTRY["income"];
    expect(meta.direction).toBe("in");
    expect(meta.affectsNetWorth).toBe(true);
  });

  it("expense flows out and affects net worth", () => {
    const meta = TRANSACTION_TYPE_REGISTRY["expense"];
    expect(meta.direction).toBe("out");
    expect(meta.affectsNetWorth).toBe(true);
  });

  it("transfer is internal and does not affect net worth", () => {
    const meta = TRANSACTION_TYPE_REGISTRY["transfer"];
    expect(meta.direction).toBe("internal");
    expect(meta.affectsNetWorth).toBe(false);
  });

  it("obligation flows out and affects net worth (MVP simplification)", () => {
    const meta = TRANSACTION_TYPE_REGISTRY["obligation"];
    expect(meta.direction).toBe("out");
    expect(meta.affectsNetWorth).toBe(true);
  });
});

describe("requiresDestinationAccount", () => {
  it("returns true only for transfer", () => {
    expect(requiresDestinationAccount("transfer")).toBe(true);
  });

  it("returns false for non-transfer types", () => {
    expect(requiresDestinationAccount("income")).toBe(false);
    expect(requiresDestinationAccount("expense")).toBe(false);
    expect(requiresDestinationAccount("obligation")).toBe(false);
  });
});
