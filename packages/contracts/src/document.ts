export interface TextSpan {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface TextLine {
  text: string;
  spans: TextSpan[];
  y: number;
}

export interface DocumentPage {
  pageIndex: number;
  width: number;
  height: number;
  lines: TextLine[];
  rawText: string;
}

export interface ParsedDocument {
  pages: DocumentPage[];
  rawText: string;
  pageCount: number;
}
