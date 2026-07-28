import { describe, it, expect } from "vitest";
import { HsbcSavingsParser } from "../hsbc/savings";
import type { ParsedDocument, DetectionResult } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "HSBC",
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

describe("HsbcSavingsParser", () => {
  const parser = new HsbcSavingsParser();

  it("parses a text-extractable HSBC India savings statement", () => {
    const doc = makeDoc([
      "The Hongkong and Shanghai Banking Corporation Limited",
      "HSBC Bank",
      "Account Number: 012345678901",
      "Statement of Account",
      "Statement Period: 01/06/2026 to 30/06/2026",
      "Currency: INR",
      "Date Particulars Withdrawal Deposit Balance",
      "Opening Balance 10000.00",
      "15/06/2026 UPI/CRED/PAYMENT 2500.00 7500.00",
      "30/06/2026 CREDIT INTEREST 12.50 7512.50",
      "Closing Balance 7512.50",
      "*** End of Statement ***",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "HSBC",
      accountType: "savings",
      accountNumber: "012345678901",
      statementPeriod: { from: "01/06/2026", to: "30/06/2026" },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(10000);
    expect(result.closingBalance).toBe(7512.5);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "15/06/2026",
      narration: "UPI/CRED/PAYMENT",
      debit: 2500,
      credit: null,
      balance: 7500,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "30/06/2026",
      narration: "CREDIT INTEREST",
      debit: null,
      credit: 12.5,
      balance: 7512.5,
      sequence: 2,
    });
  });
});
