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
      "HDFC BANK\nSAVINGS ACCOUNT\nStatement of account\nsome transactions",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
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
      "HDFC BANK\nSAVINGS ACCOUNT\nStatement of account\nUPI to INDUSIND BANK via INDB0000008",
    );
    const result = detector.detect(doc);
    expect(result).toEqual({
      bank: "HDFC",
      accountType: "savings",
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

  it("returns null for unknown bank", () => {
    const doc = makeDoc("Some random PDF content");
    expect(detector.detect(doc)).toBeNull();
  });
});
