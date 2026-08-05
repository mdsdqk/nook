import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function computeBytesHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function computeFileHash(path: string): Promise<string> {
  const bytes = await readFile(path);
  return computeBytesHash(new Uint8Array(bytes));
}
