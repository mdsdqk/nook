import type { StatementParser, DetectionResult } from "@nook/contracts";
import { HdfcSavingsParser } from "./hdfc/savings";

type ParserKey = string;

function makeKey(bank: string, accountType: string): ParserKey {
  return `${bank}|${accountType}`.toLowerCase();
}

const REGISTRY = new Map<ParserKey, () => StatementParser>([
  [makeKey("HDFC", "savings"), () => new HdfcSavingsParser()],
]);

export function getParser(
  detection: DetectionResult,
): StatementParser | null {
  const key = makeKey(detection.bank, detection.accountType);
  const factory = REGISTRY.get(key);
  return factory ? factory() : null;
}
