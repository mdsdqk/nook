import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".pdf"]);
const WEALTH_EXTENSIONS = new Set([".xlsx", ".xls"]);

export function resolveFiles(inputPath: string): string[] {
  return resolveFilesWithExtensions(inputPath, SUPPORTED_EXTENSIONS);
}

export function resolveWealthFiles(inputPath: string): string[] {
  return resolveFilesWithExtensions(inputPath, WEALTH_EXTENSIONS);
}

function resolveFilesWithExtensions(
  inputPath: string,
  extensions: Set<string>,
): string[] {
  const stat = statSync(inputPath);
  if (stat.isFile()) {
    return [inputPath];
  }

  if (stat.isDirectory()) {
    return collectFiles(inputPath, extensions);
  }

  return [];
}

function collectFiles(dir: string, extensions: Set<string>): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.has(extname(entry.name).toLowerCase())) {
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
