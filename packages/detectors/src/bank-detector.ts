import type { Detector, ParsedDocument, DetectionResult } from "@nook/contracts";

interface BankPattern {
  bank: string;
  accountType: string;
  formatVersion: string;
  match: (text: string) => boolean;
}

const PATTERNS: BankPattern[] = [
  {
    bank: "HDFC",
    accountType: "savings",
    formatVersion: "v1",
    match: (text) =>
      /HDFC\s*BANK/i.test(text) &&
      /SAVING/i.test(text) &&
      /Statement\s*of\s*account/i.test(text),
  },
];

export class BankDetector implements Detector {
  detect(doc: ParsedDocument): DetectionResult | null {
    const text = doc.rawText;
    for (const pattern of PATTERNS) {
      if (pattern.match(text)) {
        return {
          bank: pattern.bank,
          accountType: pattern.accountType,
          formatVersion: pattern.formatVersion,
        };
      }
    }
    return null;
  }
}
