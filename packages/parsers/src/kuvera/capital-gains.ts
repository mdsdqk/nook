import type {
  WorkbookDocument,
  WorkbookCell,
  WealthDetectionResult,
  WealthStatementParser,
  ParsedWealthCapitalGains,
  ParsedWealthScheme,
  ParsedWealthCapitalGainsLot,
  WealthAssetCategory,
} from "@nook/contracts";

const SCHEME_RE =
  /^(.+?)\s*\[ISIN:\s*([A-Z0-9]+)\]\s*\((Equity|Debt|Other)\)\s*$/i;
const FOLIO_RE = /^Folio No:\s*(.+)\s*$/i;
const FY_RE = /FY\s*(\d{4})\s*[-–]\s*(\d{2,4})/i;

function cellStr(cell: WorkbookCell | undefined): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function parseMoney(raw: WorkbookCell | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = cellStr(raw);
  if (!s || s === "-") return 0;
  const cleaned = s.replace(/[₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalMoney(raw: WorkbookCell | undefined): number | undefined {
  const s = cellStr(raw);
  if (!s || s === "-") return undefined;
  return parseMoney(raw);
}

/** Parse Kuvera date forms: "Mar 07, 2022" or "31-Jul-2026" → ISO. */
export function parseKuveraDate(raw: string): string {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, "0");
    const mon = monthIndex(dmy[2]!);
    return `${dmy[3]}-${mon}-${day}`;
  }

  const mdy = s.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/);
  if (mdy) {
    const day = mdy[2]!.padStart(2, "0");
    const mon = monthIndex(mdy[1]!);
    return `${mdy[3]}-${mon}-${day}`;
  }

  throw new Error(`Unrecognized date: ${raw}`);
}

function monthIndex(mon: string): string {
  const map: Record<string, string> = {
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
  const key = mon.slice(0, 3).toLowerCase();
  const m = map[key];
  if (!m) throw new Error(`Unrecognized month: ${mon}`);
  return m;
}

export function parseFyPeriod(label: string): {
  label: string;
  start: string;
  end: string;
} {
  const m = label.match(FY_RE);
  if (!m) {
    return { label: label.trim(), start: "", end: "" };
  }
  const startYear = Number(m[1]);
  let endYearPart = m[2]!;
  const endYear =
    endYearPart.length === 2
      ? Math.floor(startYear / 100) * 100 + Number(endYearPart)
      : Number(endYearPart);
  // Indian FY: Apr 1 startYear → Mar 31 endYear
  return {
    label: label.trim(),
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
  };
}

function detectPlan(schemeName: string): "direct" | "regular" {
  return /direct/i.test(schemeName) ? "direct" : "regular";
}

function detectOption(schemeName: string): "growth" | "idcw" {
  if (/idcw|dividend/i.test(schemeName)) return "idcw";
  return "growth";
}

function isSkipRow(first: string): boolean {
  return (
    /^Fund Total/i.test(first) ||
    /Sub Total/i.test(first) ||
    /^Total$/i.test(first) ||
    /^Note/i.test(first) ||
    /^Disclaimer/i.test(first) ||
    /^https:\/\//i.test(first) ||
    /^Acquisition value/i.test(first) ||
    /^As required by regulation/i.test(first) ||
    /^This (gain|statement)/i.test(first) ||
    /^You are advised/i.test(first) ||
    /^The statement does not/i.test(first)
  );
}

function isLotRow(row: WorkbookCell[]): boolean {
  // lot index numeric-ish, units present, purchase date string-like
  const idx = cellStr(row[0]);
  const units = cellStr(row[1]);
  const purchaseDate = cellStr(row[2]);
  if (!idx || !units || !purchaseDate) return false;
  if (!/^\d+(\.\d+)?$/.test(idx)) return false;
  if (!/\d/.test(units)) return false;
  return /[A-Za-z]{3}/.test(purchaseDate) || /^\d{4}-\d{2}-\d{2}/.test(purchaseDate);
}

function parseLot(row: WorkbookCell[]): ParsedWealthCapitalGainsLot {
  // Columns: index, units, buyDate, buyValue, buyNav, acqValue, jan2018Value, jan2018Nav,
  //          redeemDate, redeemValue, redeemNav, stcg, ltcg
  const quantity = parseMoney(row[1]);
  const purchaseDate = parseKuveraDate(cellStr(row[2]));
  const purchaseValue = parseMoney(row[3]);
  const purchaseNav = parseMoney(row[4]);
  const acquisitionValue = parseOptionalMoney(row[5]);
  const jan2018Value = parseOptionalMoney(row[6]);
  const jan2018Nav = parseOptionalMoney(row[7]);
  const redemptionDate = parseKuveraDate(cellStr(row[8]));
  const redemptionValue = parseMoney(row[9]);
  const redemptionNav = parseMoney(row[10]);
  const stcg = parseMoney(row[11]);
  const ltcg = parseMoney(row[12]);

  const lot: ParsedWealthCapitalGainsLot = {
    lotIndex: Math.round(parseMoney(row[0])),
    quantity,
    purchase: {
      date: purchaseDate,
      value: purchaseValue,
      nav: purchaseNav,
    },
    redemption: {
      date: redemptionDate,
      value: redemptionValue,
      nav: redemptionNav,
    },
    stcg,
    ltcg,
  };
  if (acquisitionValue !== undefined) lot.acquisitionValue = acquisitionValue;
  if (jan2018Value !== undefined) lot.jan2018Value = jan2018Value;
  if (jan2018Nav !== undefined) lot.jan2018Nav = jan2018Nav;
  return lot;
}

export class KuveraCapitalGainsParser implements WealthStatementParser {
  parse(
    doc: WorkbookDocument,
    _detection: WealthDetectionResult,
  ): ParsedWealthCapitalGains {
    const sheet = doc.sheets[0];
    if (!sheet) {
      throw new Error("Workbook has no sheets");
    }

    const rows = sheet.rows;
    let periodLabel = "";
    let generatedOn: string | undefined;
    let shortTermCapitalGains = 0;
    let longTermCapitalGains = 0;

    const schemes: ParsedWealthScheme[] = [];
    let current: ParsedWealthScheme | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const first = cellStr(row[0]);
      const second = cellStr(row[1]);

      if (i === 0 && first) {
        try {
          generatedOn = parseKuveraDate(first);
        } catch {
          // ignore non-date first cell
        }
      }

      if (/^Statement Period$/i.test(first) && second) {
        periodLabel = second;
        continue;
      }
      if (/^Short Term Capital Gains$/i.test(first)) {
        shortTermCapitalGains = parseMoney(row[1]);
        continue;
      }
      if (/^Long Term Capital Gains$/i.test(first)) {
        longTermCapitalGains = parseMoney(row[1]);
        continue;
      }

      // Skip PII rows intentionally (Name / PAN never enter IR)
      if (/^Name$/i.test(first) || /^PAN$/i.test(first)) {
        continue;
      }

      const schemeMatch = first.match(SCHEME_RE);
      if (schemeMatch) {
        if (current) schemes.push(current);
        const categoryRaw = schemeMatch[3] ?? "Other";
        const category =
          categoryRaw.charAt(0).toUpperCase() +
          categoryRaw.slice(1).toLowerCase();
        current = {
          schemeName: schemeMatch[1]!.trim(),
          isin: schemeMatch[2]!.toUpperCase(),
          folio: "",
          category: (["Equity", "Debt", "Other"].includes(category)
            ? category
            : "Other") as WealthAssetCategory,
          plan: detectPlan(schemeMatch[1]!),
          option: detectOption(schemeMatch[1]!),
          lots: [],
        };
        continue;
      }

      const folioMatch = first.match(FOLIO_RE);
      if (folioMatch && current) {
        current.folio = folioMatch[1]!.trim();
        continue;
      }

      if (isSkipRow(first)) {
        if (/^Fund Total/i.test(first) && current) {
          schemes.push(current);
          current = null;
        }
        continue;
      }

      if (current && isLotRow(row)) {
        current.lots.push(parseLot(row));
      }
    }

    if (current) schemes.push(current);

    if (!periodLabel) {
      throw new Error("Missing Statement Period in Kuvera capital gains sheet");
    }

    const period = parseFyPeriod(periodLabel);
    const result: ParsedWealthCapitalGains = {
      provider: "kuvera",
      statementType: "capital_gains",
      period,
      shortTermCapitalGains,
      longTermCapitalGains,
      schemes,
    };
    if (generatedOn) result.generatedOn = generatedOn;
    return result;
  }
}
