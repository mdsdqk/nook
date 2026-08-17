/**
 * Wealth capital-gains statement IR (Kuvera FY CG and similar).
 * Not a bank ParsedStatement - investment evidence only.
 */

export type WealthProvider = "kuvera";
export type WealthStatementType = "capital_gains";
export type WealthAssetCategory = "Equity" | "Debt" | "Other";

export interface WealthPeriod {
  /** Raw label from the statement, e.g. "FY 2025 - 26" */
  label: string;
  /** ISO date YYYY-MM-DD when derivable */
  start: string;
  /** ISO date YYYY-MM-DD when derivable */
  end: string;
}

export interface WealthLotLeg {
  date: string;
  value: number;
  nav: number;
}

export interface ParsedWealthCapitalGainsLot {
  /** 1-based lot index within the statement */
  lotIndex: number;
  quantity: number;
  purchase: WealthLotLeg;
  redemption: WealthLotLeg;
  acquisitionValue?: number;
  jan2018Value?: number;
  jan2018Nav?: number;
  stcg: number;
  ltcg: number;
}

export interface ParsedWealthScheme {
  schemeName: string;
  isin: string;
  /** Folio / container id as recorded on the statement */
  folio: string;
  category: WealthAssetCategory;
  /** Heuristic: direct | regular when detectable from scheme name */
  plan: "direct" | "regular";
  option: "growth" | "idcw";
  lots: ParsedWealthCapitalGainsLot[];
}

/**
 * Parsed Kuvera (or similar) capital-gains statement.
 * Omits PII (name, PAN) by design - never persist those fields.
 */
export interface ParsedWealthCapitalGains {
  provider: WealthProvider;
  statementType: WealthStatementType;
  period: WealthPeriod;
  /** Statement generation date if present (ISO) */
  generatedOn?: string;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  schemes: ParsedWealthScheme[];
}
