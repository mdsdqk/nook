import type { StatementParser, DetectionResult } from "@nook/contracts";
import { HdfcSavingsParser } from "./hdfc/savings";
import { IndusindIndieSavingsParser } from "./indusind/indie-savings";
import { DbsDigisavingsParser } from "./dbs/digisavings";
import { AxisSavingsParser } from "./axis/savings";
import { RblSavingsParser } from "./rbl/savings";
import { IciciSavingsParser } from "./icici/savings";
import { HsbcSavingsParser } from "./hsbc/savings";
import { HsbcSavingsAnnualParser } from "./hsbc/savings-annual";
import { IdfcSavingsParser } from "./idfc/savings";
import { SbiSavingsParser } from "./sbi/savings";
import { Kotak811SavingsParser } from "./kotak/811-savings";

type ParserKey = string;

/**
 * Registry key: bank|accountType|formatVersion
 *
 * accountType is the product/variant slug (e.g. savings, indie_savings, 811_savings).
 * formatVersion distinguishes layout revisions within the same product.
 */
function makeKey(
  bank: string,
  accountType: string,
  formatVersion: string,
  variant?: string,
): ParserKey {
  return `${bank}|${accountType}|${formatVersion}|${variant}`.toLowerCase();
}

const REGISTRY = new Map<ParserKey, () => StatementParser>([
  [
    makeKey("HDFC", "savings", "v1", "savings"),
    () => new HdfcSavingsParser(),
  ],
  [
    makeKey("INDUSIND", "savings", "v1", "indie"),
    () => new IndusindIndieSavingsParser(),
  ],
  [
    makeKey("DBS", "savings", "v1", "digisavings"),
    () => new DbsDigisavingsParser(),
  ],
  [
    makeKey("AXIS", "savings", "v1", "savings"),
    () => new AxisSavingsParser(),
  ],
  [
    makeKey("RBL", "savings", "v1", "savings"),
    () => new RblSavingsParser(),
  ],
  [
    makeKey("ICICI", "savings", "v1", "savings"),
    () => new IciciSavingsParser(),
  ],
  [
    makeKey("HSBC", "savings", "v1", "savings"),
    () => new HsbcSavingsParser(),
  ],
  [
    makeKey("HSBC", "savings", "v2", "savings"),
    () => new HsbcSavingsAnnualParser(),
  ],
  [
    makeKey("IDFC", "savings", "v1", "savings"),
    () => new IdfcSavingsParser(),
  ],
  [
    makeKey("SBI", "savings", "v1", "savings"),
    () => new SbiSavingsParser(),
  ],
  [
    makeKey("KOTAK", "savings", "v1", "811"),
    () => new Kotak811SavingsParser(),
  ],
]);

export function getParser(
  detection: DetectionResult,
): StatementParser | null {
  const key = makeKey(
    detection.bank,
    detection.accountType,
    detection.formatVersion,
    detection.variant,
  );
  const factory = REGISTRY.get(key);
  return factory ? factory() : null;
}
