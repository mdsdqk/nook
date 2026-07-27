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
      "HDFC BANK\nAccountNo : 50100684583830\nSAVINGS ACCOUNT\nStatement of account\nsome transactions",
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
      "Account Statement\nINDIE SAVINGS ACCOUNT\nBranch IFSC Code: INDB0000008\nvisit us at www.indusind.com\nThis statement is downloaded from INDIE mobile application",
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
      "HDFC BANK\nAccountNo : 50100684583830\nSAVINGS ACCOUNT\nStatement of account\nUPI to INDUSIND BANK via INDB0000008",
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
      "Team DBS\nSummary of AccountStatement Period 01-Jun-2026 to 30-Jun-2026\nSAVINGS 8291010000030454 INR 14,800.57 ACTIVE YES\nAccount Type: DIGISAVINGS\nDBS Bank India Limited\nplease login to digibank",
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
      "HDFC BANK\nAccountNo : 50100684583830\nSAVINGS ACCOUNT\nStatement of account\nUPI to DBS Bank via digibank",
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
      "Scheme: SB-PRIORITY BANKING CITI\nCurrency: INR\nStatement of Axis Account No: 5504885812 for the period (From: 27-04-2026  To: 27-07-2026)\nOPENING BALANCE           121774.27",
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
      "HDFC BANK\nAccountNo : 50100684583830\nSAVINGS ACCOUNT\nStatement of account\nUPI/P2M/123/paymen/AXIS BANK",
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
