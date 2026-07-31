/**
 * Tabular workbook IR produced by spreadsheet readers (XLSX, etc.).
 * Separate from PDF ParsedDocument used by bank statements.
 */
export type WorkbookCell = string | number | null;

export interface WorkbookSheet {
  name: string;
  rows: WorkbookCell[][];
}

export interface WorkbookDocument {
  sheets: WorkbookSheet[];
}
