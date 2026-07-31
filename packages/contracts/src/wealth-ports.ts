import type { WorkbookDocument } from "./workbook";
import type { ParsedWealthCapitalGains } from "./wealth-statement";
import type { ParseError } from "./errors";
import type { SourceInfo } from "./result";

export interface WorkbookReader {
  read(path: string): Promise<WorkbookDocument>;
}

export interface WealthDetectionResult {
  provider: "kuvera";
  statementType: "capital_gains";
  formatVersion: string;
}

export interface WealthDetector {
  detect(doc: WorkbookDocument): WealthDetectionResult | null;
}

export interface WealthStatementParser {
  parse(
    doc: WorkbookDocument,
    detection: WealthDetectionResult,
  ): ParsedWealthCapitalGains;
}

export interface WealthParseResult {
  source: SourceInfo;
  detection: WealthDetectionResult | null;
  wealthStatement: ParsedWealthCapitalGains | null;
  errors: ParseError[];
}
