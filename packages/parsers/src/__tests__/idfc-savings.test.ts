import { describe, it, expect } from "vitest";
import { IdfcSavingsParser } from "../idfc/savings";
import type { ParsedDocument, DetectionResult } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "IDFC",
  accountType: "savings",
  variant: "savings",
  formatVersion: "v1",
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

describe("IdfcSavingsParser", () => {
  const parser = new IdfcSavingsParser();

  it("parses IDFC savings statement with prefix and suffix narration wraps", () => {
    const doc = makeDoc([
      "STATEMENT OF ACCOUNT",
      "ACCOUNT NO                      :    10000000001",
      "STATEMENT PERIOD          :    2026-07-01 TO 2026-07-27",
      "IFSC: IDFB0080157",
      "ACCOUNT TYPE: CorpSal Platinum Plus",
      "NOMINATION: RegisteredCURRENCY: INR",
      "Opening Balance Total Debit Total Credit Closing Balance",
      "14,006.35 49,425.00 60,000.00 24,581.35",
      "Transaction Cheque",
      "Value Date Particulars Debit Credit Balance",
      "Date No",
      "Opening Balance 14,006.35",
      "NEFT/",
      "HSBCN18362592383/MR",
      "SAMPLE USER K/",
      "HSBC0560003/MR",
      "SAMPLE USER",
      "02-Jul-2026 02-Jul-2026 T221,2ND 60,000.00 74,006.35",
      "FLOOR,SILVER",
      "RIDGE TOWERS",
      "NORTH DISTRICT",
      "METRO CITY,STATE560002/",
      "IN",
      "NACH/HDFC BANK",
      "05-Jul-2026 05-Jul-2026 49,425.00 24,581.35",
      "LTD/468083213",
      "REGISTERED OFFICE: IDFC FIRST BANK LIMITED, KRM Tower.",
      "Page 1 of 3",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "IDFC",
      accountType: "savings",
      accountNumber: "10000000001",
      statementPeriod: {
        from: "2026-07-01",
        to: "2026-07-27",
      },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(14006.35);
    expect(result.closingBalance).toBe(24581.35);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "02-Jul-2026",
      narration:
        "NEFT/ HSBCN18362592383/MR SAMPLE USER K/ HSBC0560003/MR SAMPLE USER T221,2ND FLOOR,SILVER RIDGE TOWERS NORTH DISTRICT METRO CITY,STATE560002/ IN",
      debit: null,
      credit: 60000,
      balance: 74006.35,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "05-Jul-2026",
      narration: "NACH/HDFC BANK LTD/468083213",
      debit: 49425,
      credit: null,
      balance: 24581.35,
      sequence: 2,
    });
  });
});
