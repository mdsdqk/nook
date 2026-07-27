import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".pdf"]);

export function resolveFiles(inputPath: string): string[] {
  const stat = statSync(inputPath);
  if (stat.isFile()) {
    return [inputPath];
  }

  if (stat.isDirectory()) {
    return collectFiles(inputPath);
  }

  return [];
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

export function printSuccess(msg: string): void {
  console.log(`  \u2713 ${msg}`);
}

export function printFail(msg: string): void {
  console.log(`  \u2717 ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`  ${msg}`);
}
