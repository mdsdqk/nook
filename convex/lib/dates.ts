/** Shift an ISO date (YYYY-MM-DD) by a number of calendar days (UTC). */
export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const utcMs = Date.UTC(year, month - 1, day + deltaDays);
  return new Date(utcMs).toISOString().slice(0, 10);
}
