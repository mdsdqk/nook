import { describe, it, expect } from "vitest";
import { parseFile } from "../parse-file";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const HDFC_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/hdfc-savings.pdf",
);
const HDFC_EXPECTED = resolve(
  __dirname,
  "../../../../fixtures/hdfc/savings/expected.json",
);
const INDIE_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/indusind-indie.pdf",
);
const INDIE_EXPECTED = resolve(
  __dirname,
  "../../../../fixtures/indusind/indie_savings/expected.json",
);
const DBS_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/dbs.pdf",
);
const DBS_EXPECTED = resolve(
  __dirname,
  "../../../../fixtures/dbs/digisavings/expected.json",
);
const AXIS_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/axis.pdf",
);
const AXIS_EXPECTED = resolve(
  __dirname,
  "../../../../fixtures/axis/savings/expected.json",
);
const RBL_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/rbl.pdf",
);
const RBL_EXPECTED = resolve(
  __dirname,
  "../../../../fixtures/rbl/savings/expected.json",
);
const ICICI_PDF = resolve(
  __dirname,
  "../../../../sample_data/savings/icici.pdf",
);
const ICICI_EXPECTED = resolve(
  __dirname,
  "../../../../fixtures/icici/savings/expected.json",
);

describe("parseFile", () => {
  it("parses HDFC savings PDF matching golden fixture", async () => {
    const result = await parseFile(HDFC_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(6);
    expect(result.statement!.openingBalance).toBe(27381.41);
    expect(result.statement!.closingBalance).toBe(2159.41);

    // Match golden fixture (excluding source.path which differs)
    const expected = JSON.parse(await readFile(HDFC_EXPECTED, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("parses IndusInd Indie savings PDF matching golden fixture", async () => {
    const result = await parseFile(INDIE_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "INDUSIND",
      accountType: "savings",
      variant: "indie",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(8);
    expect(result.statement!.openingBalance).toBe(300743.41);
    expect(result.statement!.closingBalance).toBe(558275.69);

    const expected = JSON.parse(await readFile(INDIE_EXPECTED, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("parses DBS DigiSavings PDF matching golden fixture", async () => {
    const result = await parseFile(DBS_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "DBS",
      accountType: "savings",
      variant: "digisavings",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(1);
    expect(result.statement!.openingBalance).toBe(14708.57);
    expect(result.statement!.closingBalance).toBe(14800.57);

    const expected = JSON.parse(await readFile(DBS_EXPECTED, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("parses Axis savings PDF matching golden fixture", async () => {
    const result = await parseFile(AXIS_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "AXIS",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(9);
    expect(result.statement!.openingBalance).toBe(121774.27);
    expect(result.statement!.closingBalance).toBe(110919.27);

    const expected = JSON.parse(await readFile(AXIS_EXPECTED, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("parses RBL savings PDF matching golden fixture", async () => {
    const result = await parseFile(RBL_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "RBL",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(1);
    expect(result.statement!.openingBalance).toBe(2852.31);
    expect(result.statement!.closingBalance).toBe(2859.31);

    const expected = JSON.parse(await readFile(RBL_EXPECTED, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("parses ICICI savings PDF matching golden fixture", async () => {
    const result = await parseFile(ICICI_PDF);

    expect(result.errors).toEqual([]);
    expect(result.detection).toEqual({
      bank: "ICICI",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
    expect(result.validation?.passed).toBe(true);
    expect(result.statement).not.toBeNull();
    expect(result.statement!.transactions.length).toBe(11);
    expect(result.statement!.openingBalance).toBe(26694.95);
    expect(result.statement!.closingBalance).toBe(27708.75);

    const expected = JSON.parse(await readFile(ICICI_EXPECTED, "utf-8"));
    expect(result.detection).toEqual(expected.detection);
    expect(result.statement).toEqual(expected.statement);
    expect(result.validation).toEqual(expected.validation);
  });

  it("returns error for non-existent file", async () => {
    const result = await parseFile("/does/not/exist.pdf");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.code).toBe("READ_ERROR");
  });

  it("returns unknown bank for unsupported PDF", async () => {
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
