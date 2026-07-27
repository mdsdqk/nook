export enum ErrorCode {
  UnknownBank = "UNKNOWN_BANK",
  UnsupportedStatementVersion = "UNSUPPORTED_STATEMENT_VERSION",
  CorruptPDF = "CORRUPT_PDF",
  ReadError = "READ_ERROR",
  DetectionFailed = "DETECTION_FAILED",
  ParseFailed = "PARSE_FAILED",
  ValidationFailure = "VALIDATION_FAILURE",
  PersistenceFailure = "PERSISTENCE_FAILURE",
}

export interface ParseError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
