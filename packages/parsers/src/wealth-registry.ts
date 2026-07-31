import type {
  WealthDetectionResult,
  WealthStatementParser,
} from "@nook/contracts";
import { KuveraCapitalGainsParser } from "./kuvera/capital-gains";

type WealthParserKey = string;

function makeKey(
  provider: string,
  statementType: string,
  formatVersion: string,
): WealthParserKey {
  return `${provider}|${statementType}|${formatVersion}`.toLowerCase();
}

const WEALTH_REGISTRY = new Map<WealthParserKey, () => WealthStatementParser>([
  [
    makeKey("kuvera", "capital_gains", "v1"),
    () => new KuveraCapitalGainsParser(),
  ],
]);

export function getWealthParser(
  detection: WealthDetectionResult,
): WealthStatementParser | null {
  const key = makeKey(
    detection.provider,
    detection.statementType,
    detection.formatVersion,
  );
  const factory = WEALTH_REGISTRY.get(key);
  return factory ? factory() : null;
}
