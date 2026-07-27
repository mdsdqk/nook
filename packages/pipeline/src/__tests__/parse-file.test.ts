import { describe, it, expect } from "vitest";
import { parseFile } from "../parse-file";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const HDFC_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/hdfc-savings.pdf",
);
const EXPECTED_JSON = resolve(
  __dirname,
  "../../../../fixtures/hdfc/savings/expected.json",
);

describe("parseFile", () => {
  it("parses HDFC savings PDF matching golden fixture", async () => {
    const result = await parseFile(HDFC_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "HDFC",
      accountType: "savings",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(6);
    expect(result.statement!.openingBalance).toBe(27381.41);
    expect(result.statement!.closingBalance).toBe(2159.41);

    // Match golden fixture (excluding source.path which differs)
    const expected = JSON.parse(await readFile(EXPECTED_JSON, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("returns error for non-existent file", async () => {
    const result = await parseFile("/does/not/exist.pdf");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.code).toBe("READ_ERROR");
  });

  it("returns unknown bank for non-HDFC PDF", async () => {
    const sbiPdf = resolve(
      __dirname,
      "../../../../sample_data/savings/sbi.pdf",
    );
    const result = await parseFile(sbiPdf);
    expect(result.errors.some((e) => e.code === "UNKNOWN_BANK")).toBe(
      true,
    );
    expect(result.statement).toBeNull();
  });
});
