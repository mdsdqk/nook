import type { WealthParseResult, ParseError } from "@nook/contracts";
import { ErrorCode } from "@nook/contracts";
import { computeFileHash } from "@nook/shared";
import { XlsxWorkbookReader } from "@nook/readers";
import {
  KuveraCapitalGainsDetector,
  getWealthParser,
} from "@nook/parsers";
import { extname } from "node:path";

export async function parseWealthFile(path: string): Promise<WealthParseResult> {
  const errors: ParseError[] = [];

  let contentHash: string;
  try {
    contentHash = await computeFileHash(path);
  } catch (err) {
    return {
      source: { path, contentHash: "", format: "" },
      detection: null,
      wealthStatement: null,
      errors: [
        {
          code: ErrorCode.ReadError,
          message: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const format = extname(path).replace(".", "").toLowerCase();
  const source = { path, contentHash, format };

  if (format !== "xlsx" && format !== "xls") {
    return {
      source,
      detection: null,
      wealthStatement: null,
      errors: [
        {
          code: ErrorCode.ReadError,
          message: `Unsupported wealth statement format: .${format} (expected .xlsx)`,
        },
      ],
    };
  }

  let doc;
  try {
    const reader = new XlsxWorkbookReader();
    doc = await reader.read(path);
  } catch (err) {
    return {
      source,
      detection: null,
      wealthStatement: null,
      errors: [
        {
          code: ErrorCode.ReadError,
          message: `XLSX read failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const detector = new KuveraCapitalGainsDetector();
  const detection = detector.detect(doc);
  if (!detection) {
    return {
      source,
      detection: null,
      wealthStatement: null,
      errors: [
        {
          code: ErrorCode.DetectionFailed,
          message: "Could not detect wealth statement provider/format",
        },
      ],
    };
  }

  const parser = getWealthParser(detection);
  if (!parser) {
    return {
      source,
      detection,
      wealthStatement: null,
      errors: [
        {
          code: ErrorCode.UnsupportedStatementVersion,
          message: `No parser for ${detection.provider} ${detection.statementType} ${detection.formatVersion}`,
        },
      ],
    };
  }

  try {
    const wealthStatement = parser.parse(doc, detection);
    return { source, detection, wealthStatement, errors };
  } catch (err) {
    errors.push({
      code: ErrorCode.ParseFailed,
      message: `Parse failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { source, detection, wealthStatement: null, errors };
  }
}
