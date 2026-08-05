import { PDF } from "@libpdf/core";
import { readFile } from "node:fs/promises";
import type { Reader, ParsedDocument, DocumentPage, TextLine, TextSpan } from "@nook/contracts";

export class PdfReader implements Reader {
  async read(path: string): Promise<ParsedDocument> {
    const bytes = await readFile(path);
    return this.readBytes(new Uint8Array(bytes));
  }

  async readBytes(bytes: Uint8Array): Promise<ParsedDocument> {
    const pdf = await PDF.load(bytes);
    const pages: DocumentPage[] = [];

    for (const page of pdf.getPages()) {
      const extracted = page.extractText();
      const lines: TextLine[] = extracted.lines.map((line) => ({
        text: line.text,
        y: line.bbox?.y ?? 0,
        spans: line.spans.map(
          (span): TextSpan => ({
            text: span.text,
            x: span.bbox.x,
            y: span.bbox.y,
            width: span.bbox.width,
            height: span.bbox.height,
            fontSize: span.fontSize,
          }),
        ),
      }));

      pages.push({
        pageIndex: extracted.pageIndex,
        width: extracted.width,
        height: extracted.height,
        lines,
        rawText: extracted.text,
      });
    }

    return {
      pages,
      rawText: pages.map((p) => p.rawText).join("\n\n"),
      pageCount: pages.length,
    };
  }
}
