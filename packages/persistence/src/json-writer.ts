import type { ResultWriter, ParseResult } from "@nook/contracts";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export class JsonWriter implements ResultWriter {
  constructor(private outDir: string) {}

  async write(result: ParseResult): Promise<void> {
    await mkdir(this.outDir, { recursive: true });

    const filename = result.source.contentHash
      ? `${result.source.contentHash}.json`
      : `result-${Date.now()}.json`;

    const outPath = join(this.outDir, filename);
    await writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");
  }
}
