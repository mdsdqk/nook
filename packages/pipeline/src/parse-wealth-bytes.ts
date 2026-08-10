import type { WealthParseResult, ParseError } from "@nook/contracts";
import { ErrorCode } from "@nook/contracts";
import { computeBytesHash } from "@nook/shared";
import { XlsxWorkbookReader } from "@nook/readers";
import {
  KuveraCapitalGainsDetector,
  getWealthParser,
} from "@nook/parsers";

export async function parseWealthBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<WealthParseResult> {
  const errors: ParseError[] = [];
  const contentHash = computeBytesHash(bytes);
  const format = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : "xlsx";
  const source = { path: filename, contentHash, format };

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
    doc = await reader.readBytes(bytes);
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
