import { describe, it, expect, afterEach } from "vitest";
import { JsonWriter } from "../json-writer";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ParseResult } from "@nook/contracts";

function makeResult(): ParseResult {
  return {
    source: { path: "/test.pdf", contentHash: "abc123def", format: "pdf" },
    detection: { bank: "TEST", accountType: "savings", formatVersion: "v1" },
    statement: null,
    validation: null,
    errors: [],
  };
}

describe("JsonWriter", () => {
  const outDir = join(tmpdir(), "nook-test-" + Date.now());

  afterEach(async () => {
    try {
      await rm(outDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  it("writes JSON file named by content hash", async () => {
    const writer = new JsonWriter(outDir);
    const result = makeResult();
    await writer.write(result);

    const outPath = join(outDir, "abc123def.json");
    const content = JSON.parse(await readFile(outPath, "utf-8"));
    expect(content.source.contentHash).toBe("abc123def");
  });

  it("is idempotent (overwrites same file)", async () => {
    const writer = new JsonWriter(outDir);
    const result = makeResult();
    await writer.write(result);
    await writer.write(result);

    const outPath = join(outDir, "abc123def.json");
    const s = await stat(outPath);
    expect(s.isFile()).toBe(true);
  });
});
