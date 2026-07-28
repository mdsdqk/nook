import { describe, it, expect } from "vitest";
import { Kotak811SavingsParser } from "../kotak/811-savings";
import type { ParsedDocument, DetectionResult } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "KOTAK",
  accountType: "savings",
  variant: "811",
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

describe("Kotak811SavingsParser", () => {
  const parser = new Kotak811SavingsParser();

  it("parses Kotak 811 statement with debit, credit, and opening balance", () => {
    const doc = makeDoc([
      "Account Statement",
      "01 Jul 2026 - 26 Jul 2026",
      "Account No. 9847430322",
      "Account Type  Savings",
      "CRN xxxxxx120",
      "Currency INDIAN RUPEE",
      "MICR 560485055   IFSC Code KKBK0008054",
      "Savings Account Transactions",
      "# Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance",
      "- - Opening Balance - - - 35,940.39",
      "1 05 Jul 2026 UPI-P2A-MOBIKWIK 618345022694 1,500.00 - 34,440.39",
      "2 10 Jul 2026 UPI-CR-SALARY 987654321098 - 5,000.00 39,440.39",
      "Statement Generated on 27 Jul 2026, 05:03 Page 1 of ",
      "Account Summary",
      "Particulars Opening Balance Closing Balance",
      "Savings Account (SA): 35,940.39 39,440.39",
      "End of Statement ",
      "Kotak Mahindra Bank Ltd. | CIN: L65110MH1985PLC038137",
      "www.kotak.bank.in",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "KOTAK",
      accountType: "savings",
      accountNumber: "9847430322",
      statementPeriod: {
        from: "01 Jul 2026",
        to: "26 Jul 2026",
      },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(35940.39);
    expect(result.closingBalance).toBe(39440.39);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "05 Jul 2026",
      narration: "UPI-P2A-MOBIKWIK",
      reference: "618345022694",
      debit: 1500,
      credit: null,
      balance: 34440.39,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "10 Jul 2026",
      narration: "UPI-CR-SALARY",
      reference: "987654321098",
      debit: null,
      credit: 5000,
      balance: 39440.39,
      sequence: 2,
    });
  });

  it("parses empty Kotak 811 period with matching opening and closing", () => {
    const doc = makeDoc([
      "Account Statement",
      "01 Jul 2026 - 26 Jul 2026",
      "Account No. 9847430322",
      "Currency INDIAN RUPEE",
      "IFSC Code KKBK0008054",
      "Savings Account Transactions",
      "# Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance",
      "- - Opening Balance - - - 35,940.39",
      "Statement Generated on 27 Jul 2026, 05:03 Page 1 of ",
      "Account Summary",
      "Savings Account (SA): 35,940.39 35,940.39",
      "End of Statement ",
      "Kotak Mahindra Bank Ltd.",
    ]);

    const result = parser.parse(doc, DETECTION);
    expect(result.openingBalance).toBe(35940.39);
    expect(result.closingBalance).toBe(35940.39);
    expect(result.transactions).toHaveLength(0);
  });
});
