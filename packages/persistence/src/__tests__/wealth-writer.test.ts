import { describe, it, expect } from "vitest";
import {
  buildKuveraInstrumentExternalKey,
  buildKuveraLotExternalKey,
  toKuveraConvexPayload,
} from "../wealth-writer";
import type { WealthParseResult } from "@nook/contracts";

describe("Kuvera convex payload", () => {
  it("builds stable external keys", () => {
    expect(buildKuveraInstrumentExternalKey("INFTEST00001")).toBe(
      "kuvera:isin:INFTEST00001",
    );
    expect(
      buildKuveraLotExternalKey(
        "FY2025-26",
        "INFTEST00001",
        "1000000001",
        "2024-04-01",
        10.5,
        1,
        "buy",
      ),
    ).toBe(
      "kuvera:cg:FY2025-26:INFTEST00001:1000000001:2024-04-01:10.5:1:buy",
    );
  });

  it("maps parse IR to upsert payload", () => {
    const result: WealthParseResult = {
      source: {
        path: "fixture.xlsx",
        contentHash: "abc",
        format: "xlsx",
      },
      detection: {
        provider: "kuvera",
        statementType: "capital_gains",
        formatVersion: "v1",
      },
      wealthStatement: {
        provider: "kuvera",
        statementType: "capital_gains",
        period: {
          label: "FY 2025 - 26",
          start: "2025-04-01",
          end: "2026-03-31",
        },
        shortTermCapitalGains: 0,
        longTermCapitalGains: 100,
        schemes: [
          {
            schemeName: "Example Flexi Cap Growth Direct Plan",
            isin: "INFTEST00001",
            folio: "1000000001",
            category: "Equity",
            plan: "direct",
            option: "growth",
            lots: [
              {
                lotIndex: 1,
                quantity: 10,
                purchase: { date: "2024-04-01", value: 1000, nav: 100 },
                redemption: { date: "2026-03-10", value: 1500, nav: 150 },
                stcg: 0,
                ltcg: 500,
              },
            ],
          },
        ],
      },
      errors: [],
    };

    const payload = toKuveraConvexPayload(result);
    expect(payload.contentHash).toBe("abc");
    expect(payload.schemes).toHaveLength(1);
    expect(payload.schemes[0]!.lots[0]!.purchaseExternalKey).toContain(":buy");
    expect(payload.schemes[0]!.lots[0]!.redemptionExternalKey).toContain(
      ":sell",
    );
  });
});
