import type { ParseResult, ParseError } from "@nook/contracts";
import { ErrorCode } from "@nook/contracts";
import { computeBytesHash } from "@nook/shared";
import { PdfReader } from "@nook/readers";
import { BankDetector } from "@nook/detectors";
import { getParser } from "@nook/parsers";
import { StatementNormalizer } from "@nook/normalizers";
import { StatementValidator } from "@nook/validators";

export async function parseBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const contentHash = computeBytesHash(bytes);
  const format = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : "pdf";
  const source = { path: filename, contentHash, format };

  const reader = new PdfReader();
  let doc;
  try {
    doc = await reader.readBytes(bytes);
  } catch (err) {
    return {
      source,
      detection: null,
      statement: null,
      validation: null,
      errors: [
        {
          code: ErrorCode.CorruptPDF,
          message: `PDF read failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const detector = new BankDetector();
  const detection = detector.detect(doc);
  if (!detection) {
    return {
      source,
      detection: null,
      statement: null,
      validation: null,
      errors: [
        {
          code: ErrorCode.UnknownBank,
          message: "Could not detect bank from document",
        },
      ],
    };
  }

  const parser = getParser(detection);
  if (!parser) {
    return {
      source,
      detection,
      statement: null,
      validation: null,
      errors: [
        {
          code: ErrorCode.UnsupportedStatementVersion,
          message: `No parser for ${detection.bank} ${detection.variant} ${detection.accountType} ${detection.formatVersion}`,
        },
      ],
    };
  }

  let statement;
  try {
    statement = parser.parse(doc, detection);
  } catch (err) {
    return {
      source,
      detection,
      statement: null,
      validation: null,
      errors: [
        {
          code: ErrorCode.ParseFailed,
          message: `Parse failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const normalizer = new StatementNormalizer();
  statement = normalizer.normalize(statement);

  const validator = new StatementValidator();
  const validation = validator.validate(statement);

  if (!validation.passed) {
    errors.push({
      code: ErrorCode.ValidationFailure,
      message: "Validation failed",
      details: validation.entries.filter((e) => !e.passed),
    });
  }

  return { source, detection, statement, validation, errors };
}
