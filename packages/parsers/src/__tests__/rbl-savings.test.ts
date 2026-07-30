import { describe, it, expect } from "vitest";
import { RblSavingsParser } from "../rbl/savings";
import type { ParsedDocument, DetectionResult, DocumentPage } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "RBL",
  accountType: "savings",
  variant: "savings",
  formatVersion: "v1",
};

function makePage(pageIndex: number, lines: string[]): DocumentPage {
  const rawText = lines.join("\n");
  return {
    pageIndex,
    width: 595,
    height: 842,
    rawText,
    lines: lines.map((text, i) => ({
      text,
      y: 800 - i * 12,
      spans: [],
    })),
  };
}

function makeDoc(pageLines: string[][]): ParsedDocument {
  const pages = pageLines.map((lines, i) => makePage(i, lines));
  return {
    pages,
    rawText: pages.map((p) => p.rawText).join("\n\n"),
    pageCount: pages.length,
  };
}

describe("RblSavingsParser", () => {
  const parser = new RblSavingsParser();

  it("reverses newest-first rows and infers debit/credit from balance", () => {
    const doc = makeDoc([
      [
        "Statement of Transactions in Savings Account Number:309026900500",
        "Period:01-04-2025 to 30-04-2025",
        "Transaction Details Cheque ID Value Date Withdrawal Amt Deposit Amt Balance(₹)",
        "Date",
        "08/04/2025 UPI/509840703321/UPI/MD.SDQ.K-2@OKAXIS 08/04/2025 5,000.00 5,083.59",
        "01/04/2025 UPI/545752540289/UPI/MD.SDQ.K-1@OKICICI 01/04/2025 21,000.00 21,765.99",
        "01/04/2025 UPI/545753734872/NJOI/9035207185@FAM 01/04/2025 1,000.00 765.99",
        "01/04/2025 01/04/2025 1,000.00 10,305.55",
        "TEC Gurgao",
        "Statement Summary",
        "Opening Balance:₹ 11,305.55Count Of Debit:3",
        "Closing Balance:₹ 5,083.59Count Of Credit:1",
      ],
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "RBL",
      accountType: "savings",
      accountNumber: "309026900500",
      statementPeriod: { from: "01-04-2025", to: "30-04-2025" },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(11305.55);
    expect(result.closingBalance).toBe(5083.59);
    expect(result.transactions).toHaveLength(4);

    // Chronological: opening 11305.55 → debit 1000 → 10305.55
    expect(result.transactions[0]).toMatchObject({
      date: "01/04/2025",
      debit: 1000,
      credit: null,
      balance: 10305.55,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "01/04/2025",
      debit: 1000,
      credit: null,
      balance: 765.99,
      sequence: 2,
    });
    expect(result.transactions[2]).toMatchObject({
      date: "01/04/2025",
      debit: null,
      credit: 21000,
      balance: 21765.99,
      sequence: 3,
    });
    expect(result.transactions[3]).toMatchObject({
      date: "08/04/2025",
      debit: 5000,
      credit: null,
      balance: 5083.59,
      sequence: 4,
    });
  });

  it("skips date-prefixed page footers across pages", () => {
    const doc = makeDoc([
      [
        "Statement of Transactions in Savings Account Number:309026900500",
        "Period:01-10-2025 to 31-10-2025",
        "Transaction Details Cheque ID Value Date Withdrawal Amt Deposit Amt Balance(₹)",
        "Date",
        "12/10/2025 DC ANNUAL FEE 1065 Sep 2025 12/10/2025 2,360.00 19,946.31",
        "28/07/2026 11:39 am 1 Page 1 of 2",
      ],
      [
        "PCD/512293XXXXXX1065/Raz*VODAFONE IDEA LI",
        "07/10/2025 07/10/2025 5,054.00 22,306.31",
        "MI AHMEDA",
        "Statement Summary",
        "Opening Balance:₹ 17,252.31Count Of Debit:1",
        "Closing Balance:₹ 19,946.31Count Of Credit:1",
      ],
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.every((t) => !t.date.startsWith("28/07"))).toBe(
      true,
    );
    expect(result.transactions[0]).toMatchObject({
      date: "07/10/2025",
      debit: null,
      credit: 5054,
      balance: 22306.31,
      narration: expect.stringContaining("Raz*VODAFONE"),
    });
    expect(result.transactions[1]).toMatchObject({
      date: "12/10/2025",
      debit: 2360,
      credit: null,
      balance: 19946.31,
    });
  });
});
