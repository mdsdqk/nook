import { describe, it, expect } from "vitest";
import { HdfcSavingsParser } from "../hdfc/savings";
import type { ParsedDocument, DetectionResult, DocumentPage } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "HDFC",
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

describe("HdfcSavingsParser", () => {
  const parser = new HdfcSavingsParser();

  it("parses a single-page statement with summary", () => {
    const doc = makeDoc([
      [
        "AccountNo : 50100684583830",
        "Currency : INR",
        "AccountType : SAVINGSA/C-SBMAX(193)",
        "From : 01/06/2026 To : 30/06/2026Statementofaccount",
        "Date Narration Chq./Ref.No. ValueDt WithdrawalAmt. DepositAmt. ClosingBalance",
        "17/06/26 JNS-PMSBY-26-27-00383361254-865_DAP 0000SBYNL1727176 17/06/26 20.00 27,361.41",
        "28/06/26 UPI-MOHAMMEDSADIQ 0000654500284418 28/06/26 40,000.00 41,925.41",
        "K-9632740312@YESCRED-",
        "UTIB0005157-654500284418-PAIDVIACRED",
        "STATEMENTSUMMARY :-",
        "OpeningBalance DrCount CrCount Debits Credits ClosingBal",
        "27,381.41 1 1 20.00 40,000.00 41,925.41",
        "HDFCBANKLIMITED",
        "*Closingbalanceincludesfundsearmarkedforholdandunclearedfunds",
      ],
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.openingBalance).toBe(27381.41);
    expect(result.closingBalance).toBe(41925.41);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "17/06/2026",
      debit: 20,
      credit: null,
      balance: 27361.41,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "28/06/2026",
      narration: expect.stringContaining("UPI-MOHAMMEDSADIQ"),
      debit: null,
      credit: 40000,
      balance: 41925.41,
      sequence: 2,
    });
    expect(result.transactions[1]!.narration).not.toContain("HDFCBANKLIMITED");
  });

  it("parses transactions on continuation pages without a column header", () => {
    // Balances are deliberately contiguous so debit/credit inference is stable.
    const doc = makeDoc([
      [
        "AccountNo : 50100343141718",
        "Currency : INR",
        "AccountType : SAVINGS-RESIDENTS(113)",
        "From : 01/04/2025 To : 31/03/2026Statementofaccount",
        "Date Narration Chq./Ref.No. ValueDt WithdrawalAmt. DepositAmt. ClosingBalance",
        "01/04/25 UPI-ALPHA 0000102415335781 01/04/25 1,000.00 28,762.07",
        "K-S3Q@AXISBANK-UTIB00",
        "00734-102415335781-UPI",
        "06/04/25 UPI-SMARTBAZAAR 0000102697440870 06/04/25 283.50 28,478.57",
        "1@JIOPAY-JIOP0000001-102697440870-UPI",
        "HDFCBANKLIMITED",
        "*Closingbalanceincludesfundsearmarkedforholdandunclearedfunds",
      ],
      [
        "PageNo.:2",
        "AccountNo : 50100343141718",
        "From : 01/04/2025 To : 31/03/2026Statementofaccount",
        "07/04/25 UPI-PRADEEPM 0000102741316212 07/04/25 70.00 28,408.57",
        "S-BHARATPE9A0R7V2H8N971833",
        "10/04/25 UPI-KHAJA 0000102943188593 10/04/25 69.00 28,339.57",
        "HDFCBANKLIMITED",
        "*Closingbalanceincludesfundsearmarkedforholdandunclearedfunds",
      ],
      [
        "PageNo.:3",
        "AccountNo : 50100343141718",
        "From : 01/04/2025 To : 31/03/2026Statementofaccount",
        "31/03/26 UPI-SWIGGY 0000645615118964 31/03/26 207.00 28,132.57",
        "01/04/26 INTERESTPAIDTILL31-MAR-2026 000000000000000 31/03/26 831.00 28,963.57",
        "STATEMENTSUMMARY :-",
        "OpeningBalance DrCount CrCount Debits Credits ClosingBal",
        "29,762.07 5 1 1,629.50 831.00 28,963.57",
        "HDFCBANKLIMITED",
      ],
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.openingBalance).toBe(29762.07);
    expect(result.closingBalance).toBe(28963.57);
    expect(result.transactions).toHaveLength(6);

    expect(result.transactions[0]).toMatchObject({
      date: "01/04/2025",
      balance: 28762.07,
      debit: 1000,
      sequence: 1,
    });
    expect(result.transactions[0]!.narration).toContain("UPI-ALPHA");
    expect(result.transactions[0]!.narration).not.toContain("HDFCBANKLIMITED");

    expect(result.transactions[1]).toMatchObject({
      date: "06/04/2025",
      balance: 28478.57,
      debit: 283.5,
      sequence: 2,
    });
    expect(result.transactions[1]!.narration).not.toContain("HDFCBANKLIMITED");

    expect(result.transactions[2]).toMatchObject({
      date: "07/04/2025",
      balance: 28408.57,
      debit: 70,
      sequence: 3,
    });
    expect(result.transactions[3]).toMatchObject({
      date: "10/04/2025",
      balance: 28339.57,
      debit: 69,
      sequence: 4,
    });
    expect(result.transactions[4]).toMatchObject({
      date: "31/03/2026",
      balance: 28132.57,
      debit: 207,
      sequence: 5,
    });
    expect(result.transactions[5]).toMatchObject({
      date: "01/04/2026",
      credit: 831,
      balance: 28963.57,
      reference: "",
      sequence: 6,
    });
  });

  it("normalizes all-zero Chq./Ref.No. to an empty reference", () => {
    const doc = makeDoc([
      [
        "AccountNo : 50100343141718",
        "Currency : INR",
        "AccountType : SAVINGS-RESIDENTS(113)",
        "From : 01/04/2025 To : 31/03/2026Statementofaccount",
        "Date Narration Chq./Ref.No. ValueDt WithdrawalAmt. DepositAmt. ClosingBalance",
        "01/04/26 INTERESTPAIDTILL31-MAR-2026 000000000000000 31/03/26 831.00 30,593.07",
        "STATEMENTSUMMARY :-",
        "OpeningBalance DrCount CrCount Debits Credits ClosingBal",
        "29,762.07 0 1 0.00 831.00 30,593.07",
      ],
    ]);

    const result = parser.parse(doc, DETECTION);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.reference).toBe("");
  });
});
