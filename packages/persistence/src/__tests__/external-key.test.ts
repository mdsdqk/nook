import { describe, it, expect } from "vitest";
import {
  buildExternalKey,
  maskAccountNumber,
  buildAccountFingerprint,
} from "../external-key";
import type { ParsedTransaction } from "@nook/contracts";

describe("buildExternalKey", () => {
  it("uses reference when available", () => {
    const txn: ParsedTransaction = {
      date: "2026-06-17",
      narration: "test",
      debit: 100,
      credit: null,
      balance: 900,
      reference: "REF123",
      sequence: 1,
    };
    expect(buildExternalKey("HDFC", "hdfc-3830", txn)).toBe(
      "HDFC|hdfc-3830|REF123",
    );
  });

  it("falls back to positional key for zero-only references", () => {
    const txn: ParsedTransaction = {
      date: "2026-06-17",
      narration: "test",
      debit: 100,
      credit: null,
      balance: 900,
      reference: "000000000000000",
      sequence: 3,
    };
    expect(buildExternalKey("HDFC", "hdfc-3830", txn)).toBe(
      "HDFC|hdfc-3830|2026-06-17|100|3",
    );
  });
});

describe("maskAccountNumber", () => {
  it("masks all but last 4", () => {
    expect(maskAccountNumber("50100684583830")).toBe("XXXX3830");
  });

  it("returns short numbers as-is", () => {
    expect(maskAccountNumber("1234")).toBe("1234");
  });
});

describe("buildAccountFingerprint", () => {
  it("builds stable hashed fingerprint", () => {
    const fp1 = buildAccountFingerprint("HDFC", "50100684583830");
    const fp2 = buildAccountFingerprint("HDFC", "50100684583830");
    const fp3 = buildAccountFingerprint("HDFC", "12345678901234");

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1.startsWith("hdfc-")).toBe(true);
    expect(fp1.length).toBe("hdfc-".length + 16);
  });
});
