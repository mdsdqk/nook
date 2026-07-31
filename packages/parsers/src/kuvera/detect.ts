import type {
  WorkbookDocument,
  WealthDetectionResult,
  WealthDetector,
} from "@nook/contracts";

function sheetText(doc: WorkbookDocument): string {
  return doc.sheets
    .flatMap((s) => s.rows)
    .flat()
    .filter((c): c is string | number => c !== null)
    .map(String)
    .join("\n");
}

/**
 * Detect Kuvera FY Capital Gains XLSX workbooks.
 */
export class KuveraCapitalGainsDetector implements WealthDetector {
  detect(doc: WorkbookDocument): WealthDetectionResult | null {
    const text = sheetText(doc);
    const hasTitle = /Capital Gains Statement/i.test(text);
    const hasKuvera =
      /kuvera\.in/i.test(text) || /Arevuk Advisory Services/i.test(text);
    const hasFolio = /Folio No:/i.test(text);
    const hasIsin = /\[ISIN:\s*INF/i.test(text);

    if (hasTitle && hasKuvera && hasFolio && hasIsin) {
      return {
        provider: "kuvera",
        statementType: "capital_gains",
        formatVersion: "v1",
      };
    }
    return null;
  }
}
