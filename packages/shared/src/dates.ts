const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Parse common Indian bank date formats into ISO YYYY-MM-DD.
 * Supports: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MMM YYYY.
 */
export function parseIndianDate(raw: string): string {
  const cleaned = raw.trim();

  const numeric = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (numeric) {
    const [, dd, mm, yyyy] = numeric;
    return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }

  const textual = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (textual) {
    const [, dd, mon, yyyy] = textual;
    const mm = MONTHS[mon!.toLowerCase()];
    if (!mm) {
      throw new Error(`Cannot parse date: "${raw}"`);
    }
    return `${yyyy}-${mm}-${dd!.padStart(2, "0")}`;
  }

  throw new Error(`Cannot parse date: "${raw}"`);
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
