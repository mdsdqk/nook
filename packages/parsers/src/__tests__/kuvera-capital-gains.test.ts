import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { XlsxWorkbookReader } from "@nook/readers";
import {
  KuveraCapitalGainsDetector,
  KuveraCapitalGainsParser,
} from "../index";
import { parseFyPeriod, parseKuveraDate } from "../kuvera/capital-gains";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/kuvera/kuvera-cg-anonymized.xlsx",
);

describe("parseKuveraDate / parseFyPeriod", () => {
  it("parses Kuvera date formats", () => {
    expect(parseKuveraDate("Mar 07, 2022")).toBe("2022-03-07");
    expect(parseKuveraDate("31-Jul-2026")).toBe("2026-07-31");
  });

  it("parses Indian FY labels", () => {
    expect(parseFyPeriod("FY 2025 - 26")).toEqual({
      label: "FY 2025 - 26",
      start: "2025-04-01",
      end: "2026-03-31",
    });
  });
});

describe("Kuvera capital gains fixture", () => {
  it("reads and detects anonymized workbook", async () => {
    const doc = await new XlsxWorkbookReader().read(FIXTURE);
    expect(doc.sheets.length).toBe(1);
    expect(doc.sheets[0]!.rows.length).toBeGreaterThan(10);

    const detection = new KuveraCapitalGainsDetector().detect(doc);
    expect(detection).toEqual({
      provider: "kuvera",
      statementType: "capital_gains",
      formatVersion: "v1",
    });
  });

  it("parses schemes, folios, and lots without PII", async () => {
    const doc = await new XlsxWorkbookReader().read(FIXTURE);
    const detection = new KuveraCapitalGainsDetector().detect(doc)!;
    const parsed = new KuveraCapitalGainsParser().parse(doc, detection);

    expect(parsed.provider).toBe("kuvera");
    expect(parsed.period.start).toBe("2025-04-01");
    expect(parsed.period.end).toBe("2026-03-31");
    expect(parsed.schemes).toHaveLength(2);

    const equity = parsed.schemes[0]!;
    expect(equity.isin).toBe("INFTEST00001");
    expect(equity.folio).toBe("1000000001");
    expect(equity.category).toBe("Equity");
    expect(equity.plan).toBe("direct");
    expect(equity.lots).toHaveLength(2);
    expect(equity.lots[0]!.purchase.date).toBe("2024-04-01");
    expect(equity.lots[0]!.redemption.date).toBe("2026-03-10");
    expect(equity.lots[0]!.quantity).toBe(10.5);
    expect(equity.lots[0]!.ltcg).toBe(525.5);

    const debt = parsed.schemes[1]!;
    expect(debt.isin).toBe("INFTEST00002");
    expect(debt.category).toBe("Debt");
    expect(debt.lots).toHaveLength(1);

    const json = JSON.stringify(parsed);
    expect(json).not.toMatch(/Alex Example|ABCDE1234F/i);
  });

  it("rejects non-kuvera workbook", async () => {
    const detection = new KuveraCapitalGainsDetector().detect({
      sheets: [{ name: "Sheet1", rows: [["hello"], ["world"]] }],
    });
    expect(detection).toBeNull();
  });
});
