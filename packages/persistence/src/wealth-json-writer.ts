import type { WealthParseResult } from "@nook/contracts";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export class WealthJsonWriter {
  constructor(private outDir: string) {}

  async write(result: WealthParseResult): Promise<string> {
    await mkdir(this.outDir, { recursive: true });

    const filename = result.source.contentHash
      ? `wealth-${result.source.contentHash}.json`
      : `wealth-result-${Date.now()}.json`;

    const outPath = join(this.outDir, filename);
    // IR already excludes Name/PAN; write parse result as-is.
    await writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");
    return outPath;
  }
}
