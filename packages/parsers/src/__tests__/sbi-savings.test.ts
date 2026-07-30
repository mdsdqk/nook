import { describe, it, expect } from "vitest";
import { SbiSavingsParser } from "../sbi/savings";
import type { ParsedDocument, DetectionResult } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "SBI",
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

describe("SbiSavingsParser", () => {
  const parser = new SbiSavingsParser();

  it("parses SBI savings debit and credit rows with narration wraps", () => {
    const doc = makeDoc([
      "STATEMENT OF ACCOUNT",
      " State Bank of India",
      "Account Number:64000000001",
      "IFSC Code:SBIN0010363",
      "Currency:INR",
      "Clear Balance:42,606.35CR",
      "Statement From :01-07-2026 to 27-07-2026",
      "Balance",
      "POS ATM PURCH   OTHPG",
      "02/07/2026 02/07/2026 618345022694MOBIKWIK - 24,983.00 - 1,09,112.09",
      "GURUGRAM",
      "DEP TFR",
      "02/07/2026 02/07/2026 - - 1,00,000.00 2,04,450.87",
      "NEFT*HSBC0560003*HSBCN1836",
      "2592614*MR SAMPLE USER",
      "Statement Summary : 01-07-2026 To 27-07-2026",
      "Brought Forward( )Dr Count Cr Count Total Debits( )Total Credits( )Closing Balance( )",
      "1,34,095.09CR 15 4 3,29,763.74 2,38,275.00 42,606.35CR",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "SBI",
      accountType: "savings",
      accountNumber: "64000000001",
      statementPeriod: {
        from: "01-07-2026",
        to: "27-07-2026",
      },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(134095.09);
    expect(result.closingBalance).toBe(42606.35);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "02/07/2026",
      narration: "POS ATM PURCH OTHPG 618345022694MOBIKWIK GURUGRAM",
      debit: 24983,
      credit: null,
      balance: 109112.09,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "02/07/2026",
      narration: "DEP TFR NEFT*HSBC0560003*HSBCN1836 2592614*MR SAMPLE USER",
      debit: null,
      credit: 100000,
      balance: 204450.87,
      sequence: 2,
    });
  });

  it("classifies narrated credit rows (INTEREST / ACH / salary)", () => {
    const doc = makeDoc([
      "Account Number:64000000001",
      "Currency:INR",
      "Clear Balance:9,999.00CR",
      "Statement From :01-06-2025 to 30-06-2025",
      "Balance",
      "SARJAPURA ROAD",
      "25/06/2025 25/06/2025 INTEREST CREDIT - - 152.00 20,179.27",
      "CEMTEX DEP   ACHCr",
      "26/06/2025 26/06/2025 NACH00000000006516 IDFC - - 3.50 20,182.77",
      "FIRST BAN",
      "27/06/2025 27/06/2025 CEMTEX DEP   BY SALARY - - 90,000.00 1,10,182.77",
      "Statement Summary : 01-06-2025 To 30-06-2025",
      "Brought Forward( )Dr Count Cr Count Total Debits( )Total Credits( )Closing Balance( )",
      "20,027.27CR 0 3 0.00 90,155.50 1,10,182.77CR",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.closingBalance).toBe(110182.77);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({
      debit: null,
      credit: 152,
      balance: 20179.27,
      narration: expect.stringContaining("INTEREST CREDIT"),
    });
    expect(result.transactions[1]).toMatchObject({
      debit: null,
      credit: 3.5,
      balance: 20182.77,
    });
    expect(result.transactions[2]).toMatchObject({
      debit: null,
      credit: 90000,
      balance: 110182.77,
      narration: expect.stringContaining("BY SALARY"),
    });
  });

  it("prefers statement-summary closing over Clear Balance", () => {
    const doc = makeDoc([
      "Account Number:64000000001",
      "Currency:INR",
      "Clear Balance:42,606.35CR",
      "Statement From :01-04-2025 to 31-03-2026",
      "Balance",
      "31/03/2026 31/03/2026 - - 1,00,000.00 1,42,228.25",
      "Statement Summary : 01-04-2025 To 31-03-2026",
      "Brought Forward( )Dr Count Cr Count Total Debits( )Total Credits( )Closing Balance( )",
      "29,794.24CR 0 1 0.00 1,00,000.00 1,42,228.25CR",
    ]);

    const result = parser.parse(doc, DETECTION);
    expect(result.openingBalance).toBe(29794.24);
    expect(result.closingBalance).toBe(142228.25);
  });
});
