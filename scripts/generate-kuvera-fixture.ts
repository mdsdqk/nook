import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const out = join(
  import.meta.dir,
  "../packages/parsers/src/__tests__/fixtures/kuvera/kuvera-cg-anonymized.xlsx",
);

mkdirSync(dirname(out), { recursive: true });

const rows = [
  ["15-Apr-2026"],
  ["Capital Gains Statement"],
  [""],
  ["*These computations are illustrative"],
  ["Name", "Alex Example"],
  ["PAN", "ABCDE1234F"],
  ["Statement Period", "FY 2025 - 26"],
  ["Short Term Capital Gains", "₹ 0"],
  ["Long Term Capital Gains", "₹ 1,250.50"],
  [""],
  ["Transactions", "Units"],
  ["Purchase", "", "", "", "", "", "Redemption", "", "", "Gains", ""],
  [
    "",
    "",
    "Date",
    "Value",
    "NAV",
    "Acquisition Value *",
    "Jan 31st, 2018 Value",
    "NAV",
    "Date",
    "Value",
    "NAV",
    "STCG",
    "LTCG",
  ],
  ["Example Flexi Cap Growth Direct Plan [ISIN: INFTEST00001] (Equity)"],
  ["Folio No: 1000000001"],
  [
    1,
    10.5,
    "Apr 01, 2024",
    1050,
    100,
    1050,
    "-",
    "-",
    "Mar 10, 2026",
    1575.5,
    150,
    0,
    525.5,
  ],
  [
    2,
    5.25,
    "May 01, 2024",
    525,
    100,
    525,
    "-",
    "-",
    "Mar 10, 2026",
    787.5,
    150,
    0,
    262.5,
  ],
  ["Fund Total", "", "", "₹ 1,575", "", "₹ 1,575", "", "", "", "₹ 2,363", "", "₹ 0", "₹ 788"],
  [""],
  ["Example Debt Fund Growth Direct Plan [ISIN: INFTEST00002] (Debt)"],
  ["Folio No: 2000000002"],
  [
    3,
    20,
    "Jun 15, 2023",
    2000,
    100,
    2000,
    "-",
    "-",
    "Feb 01, 2026",
    2462.5,
    123.125,
    0,
    462.5,
  ],
  ["Fund Total", "", "", "₹ 2,000", "", "₹ 2,000", "", "", "", "₹ 2,462.5", "", "₹ 0", "₹ 462.5"],
  [""],
  ["", "", "", "", "", "", "", "", "", "", "Equity Sub Total", "₹ 0", "₹ 788"],
  ["", "", "", "", "", "", "", "", "", "", "Debt Sub Total", "₹ 0", "₹ 462.5"],
  ["", "", "", "", "", "", "", "", "", "", "Total", "₹ 0", "₹ 1,250.50"],
  ["Disclaimer:"],
  ["https://kuvera.in | support@kuvera.in 2026 Arevuk Advisory Services Pvt Ltd."],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "Capital Gains");
XLSX.writeFile(wb, out);
console.log("wrote", out);
