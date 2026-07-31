import type {
  ParsedWealthCapitalGains,
  WealthParseResult,
} from "@nook/contracts";

export interface KuveraConvexLotPayload {
  lotIndex: number;
  quantity: number;
  purchase: { date: string; value: number; nav: number };
  redemption: { date: string; value: number; nav: number };
  acquisitionValue?: number;
  purchaseExternalKey: string;
  redemptionExternalKey: string;
}

export interface KuveraConvexSchemePayload {
  schemeName: string;
  isin: string;
  folio: string;
  category: string;
  plan: "direct" | "regular";
  option: "growth" | "idcw";
  instrumentExternalKey: string;
  fundHouse: string;
  lots: KuveraConvexLotPayload[];
}

export interface KuveraConvexWritePayload {
  contentHash: string;
  sourcePath?: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  schemes: KuveraConvexSchemePayload[];
}

function fyToken(period: ParsedWealthCapitalGains["period"]): string {
  const m = period.label.match(/FY\s*(\d{4})\s*[-–]\s*(\d{2,4})/i);
  if (m) return `FY${m[1]}-${m[2]}`;
  return period.label.replace(/\s+/g, "");
}

function guessFundHouse(schemeName: string): string {
  const cut = schemeName.search(
    /\s+(ELSS|Flexi|Large|Mid|Small|Liquid|Debt|Equity|Tax|Fund|Hybrid)\b/i,
  );
  if (cut > 0) return schemeName.slice(0, cut).trim();
  const parts = schemeName.split(/\s+/);
  return parts.slice(0, Math.min(2, parts.length)).join(" ") || "Unknown";
}

export function buildKuveraLotExternalKey(
  fy: string,
  isin: string,
  folio: string,
  purchaseDate: string,
  quantity: number,
  lotIndex: number,
  leg: "buy" | "sell",
): string {
  return `kuvera:cg:${fy}:${isin}:${folio}:${purchaseDate}:${quantity}:${lotIndex}:${leg}`;
}

export function buildKuveraInstrumentExternalKey(isin: string): string {
  return `kuvera:isin:${isin}`;
}

/**
 * Map a wealth parse result to Convex upsert args.
 * Strips PII (already absent from IR) and builds stable external keys.
 */
export function toKuveraConvexPayload(
  result: WealthParseResult,
): KuveraConvexWritePayload {
  if (!result.wealthStatement) {
    throw new Error("Cannot write: no parsed wealth statement");
  }
  const stmt = result.wealthStatement;
  const fy = fyToken(stmt.period);

  const payload: KuveraConvexWritePayload = {
    contentHash: result.source.contentHash,
    periodLabel: stmt.period.label,
    periodStart: stmt.period.start,
    periodEnd: stmt.period.end,
    schemes: stmt.schemes.map((scheme) => ({
      schemeName: scheme.schemeName,
      isin: scheme.isin,
      folio: scheme.folio,
      category: scheme.category,
      plan: scheme.plan,
      option: scheme.option,
      instrumentExternalKey: buildKuveraInstrumentExternalKey(scheme.isin),
      fundHouse: guessFundHouse(scheme.schemeName),
      lots: scheme.lots.map((lot) => {
        const lotPayload: KuveraConvexLotPayload = {
          lotIndex: lot.lotIndex,
          quantity: lot.quantity,
          purchase: { ...lot.purchase },
          redemption: { ...lot.redemption },
          purchaseExternalKey: buildKuveraLotExternalKey(
            fy,
            scheme.isin,
            scheme.folio,
            lot.purchase.date,
            lot.quantity,
            lot.lotIndex,
            "buy",
          ),
          redemptionExternalKey: buildKuveraLotExternalKey(
            fy,
            scheme.isin,
            scheme.folio,
            lot.purchase.date,
            lot.quantity,
            lot.lotIndex,
            "sell",
          ),
        };
        if (lot.acquisitionValue !== undefined) {
          lotPayload.acquisitionValue = lot.acquisitionValue;
        }
        return lotPayload;
      }),
    })),
  };

  if (result.source.path) {
    payload.sourcePath = result.source.path;
  }

  return payload;
}
