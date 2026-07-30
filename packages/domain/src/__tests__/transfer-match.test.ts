import { describe, expect, it } from "vitest";
import {
  canBeTransferIn,
  canBeTransferOut,
  dateDiffDays,
  matchTransferPairs,
  type MatchableTransaction,
} from "../transfer-match";

function txn(
  partial: Partial<MatchableTransaction> &
    Pick<MatchableTransaction, "id" | "accountId" | "type" | "amount">,
): MatchableTransaction {
  return {
    date: "2026-07-15",
    currency: "INR",
    ...partial,
  };
}

describe("dateDiffDays", () => {
  it("returns absolute calendar distance", () => {
    expect(dateDiffDays("2026-07-15", "2026-07-18")).toBe(-3);
    expect(dateDiffDays("2026-07-18", "2026-07-15")).toBe(3);
    expect(dateDiffDays("2026-07-15", "2026-07-15")).toBe(0);
  });
});

describe("canBeTransferOut / canBeTransferIn", () => {
  it("classifies expense and income", () => {
    expect(
      canBeTransferOut(txn({ id: "1", accountId: "a", type: "expense", amount: 10 })),
    ).toBe(true);
    expect(
      canBeTransferIn(txn({ id: "1", accountId: "a", type: "expense", amount: 10 })),
    ).toBe(false);
    expect(
      canBeTransferIn(txn({ id: "1", accountId: "a", type: "income", amount: 10 })),
    ).toBe(true);
    expect(
      canBeTransferOut(txn({ id: "1", accountId: "a", type: "income", amount: 10 })),
    ).toBe(false);
  });

  it("allows unlinked transfers as wildcards", () => {
    const wildcard = txn({
      id: "1",
      accountId: "a",
      type: "transfer",
      amount: 10,
    });
    expect(canBeTransferOut(wildcard)).toBe(true);
    expect(canBeTransferIn(wildcard)).toBe(true);
  });

  it("respects transferRole and linked ids", () => {
    expect(
      canBeTransferOut(
        txn({
          id: "1",
          accountId: "a",
          type: "transfer",
          amount: 10,
          transferRole: "out",
        }),
      ),
    ).toBe(true);
    expect(
      canBeTransferIn(
        txn({
          id: "1",
          accountId: "a",
          type: "transfer",
          amount: 10,
          transferRole: "out",
        }),
      ),
    ).toBe(false);
    expect(
      canBeTransferOut(
        txn({
          id: "1",
          accountId: "a",
          type: "expense",
          amount: 10,
          linkedTransactionId: "x",
        }),
      ),
    ).toBe(false);
  });
});

describe("matchTransferPairs", () => {
  it("pairs expense with income within ±3 days", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "out",
        accountId: "a",
        type: "expense",
        amount: 500,
        date: "2026-07-15",
      }),
      txn({
        id: "in",
        accountId: "b",
        type: "income",
        amount: 500,
        date: "2026-07-18",
      }),
    ]);
    expect(pairs).toEqual([{ outId: "out", inId: "in" }]);
  });

  it("skips pairs outside the date window", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "out",
        accountId: "a",
        type: "expense",
        amount: 500,
        date: "2026-07-15",
      }),
      txn({
        id: "in",
        accountId: "b",
        type: "income",
        amount: 500,
        date: "2026-07-19",
      }),
    ]);
    expect(pairs).toEqual([]);
  });

  it("requires different accounts and matching currency", () => {
    expect(
      matchTransferPairs([
        txn({
          id: "out",
          accountId: "a",
          type: "expense",
          amount: 500,
        }),
        txn({
          id: "in",
          accountId: "a",
          type: "income",
          amount: 500,
        }),
      ]),
    ).toEqual([]);

    expect(
      matchTransferPairs([
        txn({
          id: "out",
          accountId: "a",
          type: "expense",
          amount: 500,
          currency: "INR",
        }),
        txn({
          id: "in",
          accountId: "b",
          type: "income",
          amount: 500,
          currency: "USD",
        }),
      ]),
    ).toEqual([]);
  });

  it("does not reuse a transaction across pairs", () => {
    const pairs = matchTransferPairs([
      txn({ id: "out", accountId: "a", type: "expense", amount: 100 }),
      txn({ id: "in1", accountId: "b", type: "income", amount: 100 }),
      txn({ id: "in2", accountId: "c", type: "income", amount: 100 }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.outId).toBe("out");
  });

  it("skips already-linked rows", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "out",
        accountId: "a",
        type: "expense",
        amount: 500,
        linkedTransactionId: "x",
      }),
      txn({
        id: "in",
        accountId: "b",
        type: "income",
        amount: 500,
      }),
    ]);
    expect(pairs).toEqual([]);
  });

  it("pairs expense with an unlinked transfer", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "out",
        accountId: "a",
        type: "expense",
        amount: 250,
      }),
      txn({
        id: "in",
        accountId: "b",
        type: "transfer",
        amount: 250,
      }),
    ]);
    expect(pairs).toEqual([{ outId: "out", inId: "in" }]);
  });

  it("pairs an unlinked transfer with income", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "out",
        accountId: "a",
        type: "transfer",
        amount: 250,
      }),
      txn({
        id: "in",
        accountId: "b",
        type: "income",
        amount: 250,
      }),
    ]);
    expect(pairs).toEqual([{ outId: "out", inId: "in" }]);
  });

  it("pairs two unlinked transfers", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "a",
        accountId: "acct1",
        type: "transfer",
        amount: 75,
      }),
      txn({
        id: "b",
        accountId: "acct2",
        type: "transfer",
        amount: 75,
      }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0]!.outId, pairs[0]!.inId])).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("prefers the closer date match", () => {
    const pairs = matchTransferPairs([
      txn({
        id: "out",
        accountId: "a",
        type: "expense",
        amount: 40,
        date: "2026-07-15",
      }),
      txn({
        id: "far",
        accountId: "b",
        type: "income",
        amount: 40,
        date: "2026-07-18",
      }),
      txn({
        id: "near",
        accountId: "c",
        type: "income",
        amount: 40,
        date: "2026-07-16",
      }),
    ]);
    expect(pairs).toEqual([{ outId: "out", inId: "near" }]);
  });
});
