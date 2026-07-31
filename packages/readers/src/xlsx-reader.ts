import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import type {
  WorkbookReader,
  WorkbookDocument,
  WorkbookCell,
} from "@nook/contracts";

function toCell(value: unknown): WorkbookCell {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export class XlsxWorkbookReader implements WorkbookReader {
  async read(path: string): Promise<WorkbookDocument> {
    const bytes = await readFile(path);
    const workbook = XLSX.read(bytes, {
      type: "buffer",
      cellDates: false,
      raw: false,
    });

    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) {
        return { name, rows: [] as WorkbookCell[][] };
      }
      const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(
        sheet,
        {
          header: 1,
          defval: null,
          raw: false,
          blankrows: true,
        },
      );
      const rows = matrix.map((row) =>
        (Array.isArray(row) ? row : []).map(toCell),
      );
      return { name, rows };
    });

    return { sheets };
  }
}
