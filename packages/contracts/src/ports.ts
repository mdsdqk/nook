import type { ParsedDocument } from "./document";
import type { DetectionResult } from "./result";
import type { ParsedStatement } from "./statement";
import type { ValidationResult } from "./result";
import type { ParseResult } from "./result";

export interface Reader {
  read(path: string): Promise<ParsedDocument>;
}

export interface Detector {
  detect(doc: ParsedDocument): DetectionResult | null;
}

export interface StatementParser {
  parse(doc: ParsedDocument, detection: DetectionResult): ParsedStatement;
}

export interface Normalizer {
  normalize(statement: ParsedStatement): ParsedStatement;
}

export interface Validator {
  validate(statement: ParsedStatement): ValidationResult;
}

export interface ResultWriter {
  write(result: ParseResult): Promise<void>;
}
