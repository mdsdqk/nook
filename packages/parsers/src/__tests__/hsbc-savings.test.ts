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

  it("parses HSBC savings layout with wrapped lines", () => {
    const doc = makeDoc([
      "HSBC Premier Composite Statement",
      "SAVINGS ACCOUNT-RES 111-222333-444",
      "Date Transaction Details Deposits Withdrawals Balance",
      "(DR=Debit)",
      "INR",
      "01Jun2026 BALANCE BROUGHT FORWARD 342,823.74",
      "02Jun2026 UPI20260602000540936",
      "651910462191",
      "Sample User K 99,000.00 243,823.74",
      "30Jun2026 IN22618139921961",
      "ICICN22026063039921961",
      "SAMPLE SYSTEMS PRIVATE LIMITE",
      "2026/06/30 144952 IN22618139921961 307,445.00 551,268.74",
      "01Jul2026 CREDIT INTEREST",
      "FROM APR26 TO JUN26 274.33 551,543.07",
      "CLOSING BALANCE 551,543.07",
      "Transaction Turnover 307,719.33 99,000.00",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "HSBC",
      accountType: "savings",
      accountNumber: "111-222333-444",
      statementPeriod: { from: "02 Jun 2026", to: "01 Jul 2026" },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(342823.74);
    expect(result.closingBalance).toBe(551543.07);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({
      date: "02 Jun 2026",
      narration: "UPI20260602000540936 651910462191 Sample User K",
      debit: 99000,
      credit: null,
      balance: 243823.74,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "30 Jun 2026",
      narration:
        "IN22618139921961 ICICN22026063039921961 SAMPLE SYSTEMS PRIVATE LIMITE 2026/06/30 144952 IN22618139921961",
      debit: null,
      credit: 307445,
      balance: 551268.74,
      sequence: 2,
    });
    expect(result.transactions[2]).toMatchObject({
      date: "01 Jul 2026",
      narration: "CREDIT INTEREST FROM APR26 TO JUN26",
      debit: null,
      credit: 274.33,
      balance: 551543.07,
      sequence: 3,
    });
  });
});
