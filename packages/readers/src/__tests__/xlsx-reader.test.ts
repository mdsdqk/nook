import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { XlsxWorkbookReader } from "../xlsx-reader";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../parsers/src/__tests__/fixtures/kuvera/kuvera-cg-anonymized.xlsx",
);

describe("XlsxWorkbookReader", () => {
  it("reads anonymized Kuvera fixture", async () => {
    const doc = await new XlsxWorkbookReader().read(FIXTURE);
    expect(doc.sheets.length).toBe(1);
    expect(doc.sheets[0]!.name.length).toBeGreaterThan(0);
    const flat = doc.sheets[0]!.rows.flat().map(String).join(" ");
    expect(flat).toMatch(/Capital Gains Statement/);
  });
});
