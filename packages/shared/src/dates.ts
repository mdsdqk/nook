/**
 * Parse DD/MM/YYYY or DD-MM-YYYY into ISO YYYY-MM-DD.
 */
export function parseIndianDate(raw: string): string {
  const cleaned = raw.trim();
  const match = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) {
    throw new Error(`Cannot parse date: "${raw}"`);
  }
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
}

/**
 * Ensure a date string is in ISO YYYY-MM-DD format.
 * If already ISO, returns as-is.
 */
export function toISODate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  return parseIndianDate(raw);
}
