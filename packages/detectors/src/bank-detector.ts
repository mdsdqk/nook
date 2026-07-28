import type { Detector, ParsedDocument, DetectionResult } from "@nook/contracts";

interface BankPattern {
  bank: string;
  accountType: string;
  formatVersion: string;
  variant?: string;
  match: (text: string) => boolean;
}

/**
 * Patterns are ordered; first match wins.
 *
 * variant is a product/variant slug so banks with multiple statement
 * layouts can coexist (e.g. INDUSIND indie_savings vs savings, KOTAK 811_savings).
 * formatVersion tracks layout revisions within a variant.
 */
const PATTERNS: BankPattern[] = [
  {
    bank: "AXIS",
    accountType: "savings",
    variant: "savings",
    formatVersion: "v1",
    match: (text) =>
      /Statement\s+of\s+Axis\s+Account\s+No/i.test(text),
  },
  {
    bank: "HDFC",
    accountType: "savings",
    variant: "savings",
    formatVersion: "v1",
    match: (text) =>
      /HDFC\s*BANK/i.test(text) &&
      /AccountNo\s*:/i.test(text) &&
      /SAVING/i.test(text) &&
      /Statement\s*of\s*account/i.test(text),
  },
  {
    bank: "INDUSIND",
    accountType: "savings",
    variant: "indie",
    formatVersion: "v1",
    match: (text) =>
      /INDIE\s+SAVINGS/i.test(text) &&
      (/INDUSIND\s+BANK/i.test(text) ||
        /indusind\.com/i.test(text) ||
        /INDB\d{4,}/i.test(text) ||
        /INDIE\s+mobile\s+application/i.test(text)),
  },
  {
    bank: "DBS",
    accountType: "savings",
    variant: "digisavings",
    formatVersion: "v1",
    match: (text) =>
      (/DBS\s+Bank/i.test(text) ||
        /DBS\s+Bank\s+India/i.test(text) ||
        /dbs\.com\/india/i.test(text) ||
        /DBSS0[A-Z0-9]+/i.test(text) ||
        /digibank/i.test(text)) &&
      (/DIGISAVINGS/i.test(text) ||
        (/Summary\s+of\s+Account/i.test(text) &&
          /Statement\s*Period/i.test(text))),
  },
  {
    bank: "RBL",
    accountType: "savings",
    variant: "savings",
    formatVersion: "v1",
    match: (text) =>
      /Statement\s+of\s+Transactions\s+in\s+Savings\s+Account\s+Number/i.test(
        text,
      ) &&
      (/RATN\d{4,}/i.test(text) ||
        /RBL\s+Bank/i.test(text) ||
        /rblbank\.com/i.test(text)),
  },
  {
    bank: "HSBC",
    accountType: "savings",
    variant: "savings",
    formatVersion: "v1",
    match: (text) =>
      (/Hongkong\s+and\s+Shanghai\s+Banking\s+Corporation/i.test(text) ||
        /\bHSBC\s+Bank\b/i.test(text) ||
        /hsbc\.co\.in/i.test(text) ||
        /IFSC(?:\s*Code)?\s*:?\s*HSBC0[A-Z0-9]+/i.test(text)) &&
      (/Statement\s+of\s+Account/i.test(text) ||
        /Account\s+Statement/i.test(text) ||
        /Savings\s+Account/i.test(text)),
  },
];

export class BankDetector implements Detector {
  detect(doc: ParsedDocument): DetectionResult | null {
    const text = doc.rawText;
    for (const pattern of PATTERNS) {
      if (pattern.match(text)) {
        return {
          bank: pattern.bank,
          variant: pattern.variant,
          accountType: pattern.accountType,
          formatVersion: pattern.formatVersion,
        };
      }
    }
    return null;
  }
}
