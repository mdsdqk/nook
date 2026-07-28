import { describe, it, expect } from "vitest";
import { IciciSavingsParser } from "../icici/savings";
import type { ParsedDocument, DetectionResult } from "@nook/contracts";

const DETECTION: DetectionResult = {
  bank: "ICICI",
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

describe("IciciSavingsParser", () => {
  const parser = new IciciSavingsParser();

  it("parses ICICI savings statement with prefix names and UPI wrap", () => {
    const doc = makeDoc([
      "Statement of Transactions in Saving Account no. 233800000001 in INR for the period July 19, 2026 - July 27, 2026",
      "ICICI BANK LIMITED",
      "Transaction Withdrawal Deposit Balance",
      "S No. Cheque Number Transaction Remarks",
      "Date Amount (INR) Amount (INR) (INR)",
      "SAMPLE ONE",
      "1 19.07.2026 10.00 26684.95",
      "UPI/SAMPLE ONE/9000000001@ybl/UPI/Punjab",
      "Nat/620097443993/",
      "SAMPLE TWO",
      "2 23.07.2026 100000.00 115721.95",
      "UPI/SAMPLE TWO/9000000002@ybl/Payment fr/HDFC",
      "www.icici.bank.in Dial your Bank 1800-1080",
      "Team ICICI Bank",
    ]);

    const result = parser.parse(doc, DETECTION);

    expect(result.metadata).toEqual({
      bank: "ICICI",
      accountType: "savings",
      accountNumber: "233800000001",
      statementPeriod: {
        from: "July 19, 2026",
        to: "July 27, 2026",
      },
      currency: "INR",
    });
    expect(result.openingBalance).toBe(26694.95);
    expect(result.closingBalance).toBe(115721.95);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "19.07.2026",
      narration:
        "SAMPLE ONE UPI/SAMPLE ONE/9000000001@ybl/UPI/Punjab Nat/620097443993/",
      debit: 10,
      credit: null,
      balance: 26684.95,
      sequence: 1,
    });
    expect(result.transactions[1]).toMatchObject({
      date: "23.07.2026",
      narration:
        "SAMPLE TWO UPI/SAMPLE TWO/9000000002@ybl/Payment fr/HDFC",
      debit: null,
      credit: 100000,
      balance: 115721.95,
      sequence: 2,
    });
  });
});
