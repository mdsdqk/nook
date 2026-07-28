import { describe, it, expect } from "vitest";
import { BankDetector } from "../bank-detector";
import type { ParsedDocument } from "@nook/contracts";

function makeDoc(rawText: string): ParsedDocument {
  return { pages: [], rawText, pageCount: 1 };
}

describe("BankDetector", () => {
  const detector = new BankDetector();

  it("detects HDFC Savings", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nsome transactions",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects IndusInd Indie savings", () => {
    const doc = makeDoc(
      "Account Statement\nINDIE SAVINGS ACCOUNT\nBranch IFSC Code: INDB0000123\nvisit us at www.indusind.com\nThis statement is downloaded from INDIE mobile application",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "INDUSIND",
      accountType: "savings",
      variant: "indie",
      formatVersion: "v1",
    });
  });

  it("does not detect IndusInd Indie from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI to INDUSIND BANK via INDB0000123",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect HDFC from transaction mentions", () => {
    const doc = makeDoc(
      "AXIS BANK\nPaid v/HDFC BANK LTD\nStatement of some other bank\nSAVINGS",
    );
    const result = detector.detect(doc);
    expect(result).toBeNull();
  });

  it("detects DBS DigiSavings", () => {
    const doc = makeDoc(
      "Team DBS\nSummary of AccountStatement Period 01-Jan-2026 to 31-Jan-2026\nSAVINGS 8291010000012345 INR 12,345.67 ACTIVE YES\nAccount Type: DIGISAVINGS\nDBS Bank India Limited\nplease login to digibank",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "DBS",
      accountType: "savings",
      variant: "digisavings",
      formatVersion: "v1",
    });
  });

  it("does not detect DBS from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI to DBS Bank via digibank",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects Axis savings", () => {
    const doc = makeDoc(
      "Scheme: SB-PRIORITY BANKING CITI\nCurrency: INR\nStatement of Axis Account No: 1234567890 for the period (From: 01-01-2026  To: 31-03-2026)\nOPENING BALANCE           10000.00",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "AXIS",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect Axis from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2M/123/paymen/AXIS BANK",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects RBL savings", () => {
    const doc = makeDoc(
      "IFSC/RTGS/NEFT Code:RATN0000123\nA/C Type:SAVINGS\nStatement of Transactions in Savings Account Number:123456789012\nPeriod:01-01-2026 to 31-01-2026\nOpening Balance:₹ 1,000.00",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "RBL",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect RBL from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI to RBL Bank via RATN0000123",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects ICICI savings", () => {
    const doc = makeDoc(
      "Statement of Transactions in Saving Account no. 123456789012 in INR for the period July 19, 2026 - July 27, 2026\nICICI BANK LIMITED\nTransaction Withdrawal Deposit Balance\nS No. Cheque Number Transaction Remarks\nwww.icici.bank.in\nTeam ICICI Bank",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "ICICI",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect ICICI from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2A/123/Paid v/ICICI BANK/www.icici.bank.in",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects HSBC savings", () => {
    const doc = makeDoc(
      "The Hongkong and Shanghai Banking Corporation Limited\nHSBC Bank\nAccount Number: 123456789012\nStatement of Account\nSavings Account\nIFSC Code: HSBC0000123\nwww.hsbc.co.in",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HSBC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects HSBC annual savings export as v2", () => {
    const doc = makeDoc(
      "HSBC Account Statement\nAccount summary and transactions\nSearch results\nDate range: 01/04/2025 - 31/03/2026\nDate Description Credit Debit Balance\nAccount number: 111-222333-444",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HSBC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v2",
    });
  });

  it("does not detect HSBC from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2A/123/Paid v/HSBC",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect HSBC from NEFT counterparty codes", () => {
    const doc = makeDoc(
      "State Bank of India\nSTATEMENT OF ACCOUNT\nAccount Number:12345678901\nIFSC Code:SBIN0001234\nNEFT*HSBC0123456*HSBCN0001",
    );
    const result = detector.detect(doc);
    expect(result?.bank).not.toBe("HSBC");
    expect(result).toEqual({
      bank: "SBI",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects IDFC savings", () => {
    const doc = makeDoc(
      "STATEMENT OF ACCOUNT\nACCOUNT NO : 10215956093\nSTATEMENT PERIOD : 2026-07-01 TO 2026-07-27\nIFSC: IDFB0080157\nREGISTERED OFFICE: IDFC FIRST BANK LIMITED\nbanker@idfcfirstbank.com",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "IDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect IDFC from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2A/123/Paid v/IDFC FIRST BANK/IDFB0080157",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects SBI savings", () => {
    const doc = makeDoc(
      "STATEMENT OF ACCOUNT\n State Bank of India\nAccount Number:64098746129\nIFSC Code:SBIN0010363\nStatement From :01-07-2026 to 27-07-2026\nsbi.10363@sbi.co.in",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "SBI",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("does not detect SBI from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2A/123/Paid v/State Bank of India/SBIN0010363",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("detects Kotak 811 savings", () => {
    const doc = makeDoc(
      "Account Statement\n01 Jul 2026 - 26 Jul 2026\nAccount No. 9847430322\nAccount Type  Savings\nCRN xxxxxx120\nIFSC Code KKBK0008054\nSavings Account Transactions\nKotak Mahindra Bank Ltd.\nwww.kotak.bank.in",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "KOTAK",
      accountType: "savings",
      variant: "811",
      formatVersion: "v1",
    });
  });

  it("does not detect Kotak from narration alone", () => {
    const doc = makeDoc(
      "HDFC BANK\nAccountNo : 50100123456789\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2A/123/Paid v/Kotak Mahindra Bank/KKBK0008054",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
      variant: "savings",
      formatVersion: "v1",
    });
  });

  it("returns null for unknown bank", () => {
    const doc = makeDoc("Some random PDF content");
    expect(detector.detect(doc)).toBeNull();
  });
});
