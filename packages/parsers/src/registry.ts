import type { StatementParser, DetectionResult } from "@nook/contracts";
import { HdfcSavingsParser } from "./hdfc/savings";
import { IndusindIndieSavingsParser } from "./indusind/indie-savings";
import { DbsDigisavingsParser } from "./dbs/digisavings";
import { AxisSavingsParser } from "./axis/savings";

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
    () => new HdfcSavingsParser()],
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
