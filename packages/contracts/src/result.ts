import type { ParsedStatement } from "./statement";
import type { ParseError } from "./errors";

export interface SourceInfo {
  path: string;
  contentHash: string;
  format: string;
}

export interface DetectionResult {
  bank: string;
  accountType: string;
  variant?: string | undefined;
  formatVersion: string;
}

export type ValidationCategory = "structural" | "financial" | "semantic";

export interface ValidationEntry {
  category: ValidationCategory;
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  entries: ValidationEntry[];
}

export interface ParseResult {
  source: SourceInfo;
  detection: DetectionResult | null;
  statement: ParsedStatement | null;
  validation: ValidationResult | null;
  errors: ParseError[];
}
