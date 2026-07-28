import { describe, it, expect } from "vitest";
import { HsbcSavingsAnnualParser } from "../hsbc/savings-annual";
import type { ParsedDocument, DetectionResult } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "HSBC",
  accountType: "savings",
  variant: "savings",
  formatVersion: "v2",
};

function makeDoc(lines: string[]): ParsedDocument {
  const rawText = lines.join("\n");
  return {
    pages: [
      {
        pageIndex: 0,
        width: 595,
        height: 842,
        rawText,
        lines: lines.map((text, i) => ({
          text,
          y: 800 - i * 12,
          spans: [],
        })),
      },
    ],
    rawText,
    pageCount: 1,
  };
}

describe("HsbcSavingsAnnualParser", () => {
  const parser = new HsbcSavingsAnnualParser();

  it("parses annual HSBC account-summary export with wrapped narration", () => {
    const doc = makeDoc([
      "HSBC Account Statement",
      "Account summary and transactions",
      "Account number: 111-222333-444",
      "Search results",
      "Date range: 01/04/2025 - 31/03/2026",
      "Date Description Credit Debit Balance",
      "31/03/2026 TRANSFER  50,000.00  152,645.14",
      "TRANSFER",
      "UPI20260331000446072",
      "609086164028",
      "sample.user@bank",
      "12/09/2025 TRANSFER  20,000.00  202,645.14",
      "TRANSFER",
      "UPI20250912000453603",
      "31/08/2025 TRANSFER  250.00  182,645.14",
      "TRANSFER",
      "UPI20250901000126987",
      "about:blank 1/24",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "HSBC",
      accountType: "savings",
      accountNumber: "111-222333-444",
      statementPeriod: { from: "01/04/2025", to: "31/03/2026" },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(182395.14);
    expect(result.closingBalance).toBe(152645.14);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({
      date: "31/08/2025",
      narration: "TRANSFER TRANSFER UPI20250901000126987",
      credit: 250,
      debit: null,
      balance: 182645.14,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "12/09/2025",
      narration: "TRANSFER TRANSFER UPI20250912000453603",
      credit: 20000,
      debit: null,
      balance: 202645.14,
      sequence: 2,
    });
    expect(result.transactions[2]).toMatchObject({
      date: "31/03/2026",
      narration:
        "TRANSFER TRANSFER UPI20260331000446072 609086164028 sample.user@bank",
      credit: null,
      debit: 50000,
      balance: 152645.14,
      sequence: 3,
    });
  });
});
