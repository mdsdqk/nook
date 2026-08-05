import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMPORT_POLICY,
  filterStatementFiles,
  isPdfFile,
} from "./statement-import";

function fakeFile(
  name: string,
  size: number,
  type = "application/pdf",
): File {
  const blob = new Blob([new Uint8Array(1)], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("isPdfFile", () => {
  it("accepts .pdf with application/pdf", () => {
    expect(isPdfFile(fakeFile("stmt.pdf", 100))).toBe(true);
  });

  it("rejects non-pdf extension even with pdf mime", () => {
    expect(isPdfFile(fakeFile("stmt.exe", 100, "application/pdf"))).toBe(
      false,
    );
  });

  it("rejects wrong mime with .pdf name", () => {
    expect(isPdfFile(fakeFile("stmt.pdf", 100, "application/octet-stream"))).toBe(
      false,
    );
  });

  it("accepts empty mime with .pdf name", () => {
    expect(isPdfFile(fakeFile("stmt.pdf", 100, ""))).toBe(true);
  });
});

describe("filterStatementFiles", () => {
  it("enforces max files per batch", () => {
    const files = Array.from({ length: 7 }, (_, i) =>
      fakeFile(`s${i}.pdf`, 100),
    );
    const { accepted, rejected } = filterStatementFiles(files, {
      ...DEFAULT_IMPORT_POLICY,
      maxFilesPerBatch: 5,
    });
    expect(accepted).toHaveLength(5);
    expect(rejected).toHaveLength(2);
  });

  it("enforces per-file and batch byte caps", () => {
    const big = fakeFile("big.pdf", DEFAULT_IMPORT_POLICY.maxBytesPerFile + 1);
    const { accepted, rejected } = filterStatementFiles([big]);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toMatch(/Exceeds/);
  });
});
