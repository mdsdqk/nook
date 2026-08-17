# Wealth Domain

Instrument-centric wealth model for Nook / HF-FOS. Mutual funds are the first asset class; the core shape is asset-class agnostic.

## Layers

```text
Evidence  →  Instrument  →  AssetTransaction  →  Holding  →  computePortfolio()  →  Views
```

| Layer | Role |
|-------|------|
| **Evidence** (`wealthEvidence`) | Immutable provenance. Never used in wealth math. Never updates Holdings. |
| **Instrument** | Catalog definition of something that can be owned (exists whether or not the user holds it). |
| **AssetTransaction** | Source of truth for ownership events. |
| **Holding** | Materialized derived position. Recomputed only by mutations that write AssetTransactions. |
| **Portfolio** | Not an entity. Pure computation (`computePortfolio`), like `computeNetWorth`. |

Money owns cash (accounts, assertions, bank transactions). Wealth **consumes** liquid balances read-only. One direction only - Wealth must not become a second cash ledger.

## Instrument vs Holding

- **Instrument** = the thing (e.g. Parag Parikh Flexi Cap Fund).
- **Holding** = the user’s ownership of that instrument in a container.

### User-scoped Instruments (temporary)

This iteration stores Instruments with `userId` for simpler manual entry.

That is an **implementation convenience**, not the long-term model. Instruments belong in a shared **Instrument Catalog**. Users own Holdings, not Instruments. CAS for two users must not create duplicate catalog rows.

## Container

A **container** is the account, folio, wallet, demat account, or any other logical location in which ownership of an instrument is recorded.

Holding identity:

```text
ownerId + instrumentId + containerId
```

Do not hardcode “folio” into the type system.

## AssetTransaction

Economic event types (not execution mechanisms):

- `purchase` | `redemption` | `dividend` | `switch_in` | `switch_out` | `bonus`

Optional `executionType` (e.g. `sip`, `lumpsum`, `stp`, `swp`) describes how the event was executed. A SIP is `type: "purchase", executionType: "sip"`.

### Identity

- Primary: document `_id`
- Idempotency when `externalKey` is present: unique on `(ownerId, instrumentId, externalKey)`

### Quantity

Use **`quantity`** (optional), not `units`:

| Asset class | Meaning |
|-------------|---------|
| Mutual fund | Units |
| Stocks | Shares |
| Gold | Grams |
| Crypto | Quantity |
| FD / real estate | Often omitted (amount-driven) |

### Source type vs priority

Store `sourceType` only (`broker_api` | `broker_statement` | `cas` | `manual`).

Priority belongs in reconciliation logic, not on rows:

`broker_api > broker_statement > cas > manual`

Optional `bankTransactionId` may link to a Money ledger transaction. Missing links must not affect wealth calculations.

## Holdings derivation

- AssetTransactions are the source of truth.
- Holdings are derived via `deriveHolding` with a pluggable **`CostBasisStrategy`** (`"average"` today; FIFO later).
- Evidence never changes Holdings. Mutations that write AssetTransactions recompute them.

### Valuation (out of scope for price discovery)

`currentValue` / `lastPrice` use the latest known price available to derivation. This iteration defaults to **last transaction price**.

Transaction NAV is **not** live market value. Future price discovery (e.g. AMFI NAV) should refresh Holding valuation without rewriting AssetTransactions. Pass optional `valuation: { price, asOf }` into `deriveHolding` when a market feed exists.

## Portfolio

```ts
computePortfolio(holdings, liquidMoney, instruments?)
```

Returns totals and allocations by asset class / provider / category. Liquid cash appears as a `cash` allocation slice from Money account balances (bank / cash / wallet).

## Manual evidence path

1. `wealth.createManualInstrument` - catalog entry (+ evidence note). Does not create a Holding.
2. `wealth.recordManualAssetTransaction` - evidence → AssetTransaction → recompute Holding.
3. `wealth.linkBankTransaction` - optional link only; no holding math change.

Queries: `listInstruments`, `listHoldings`, `getPortfolio`.

Domain logic lives in `@nook/domain`; Convex wrappers stay thin.

## Broker statement ingest (Kuvera capital gains)

Kuvera FY **Capital Gains** XLSX is investment evidence (`sourceType: broker_statement`), not Money/bank evidence.

Pipeline:

```text
xlsx → XlsxWorkbookReader → KuveraCgDetector → KuveraCgParser
    → ParsedWealthCapitalGains
    → CLI (--out JSON | --convex upsertKuveraCapitalGains)
```

CLI: `bun run wealth parse <xlsx> [--out dir] [--convex]` (requires `bun run statement auth login` first)

Each CG row is a **closed FIFO lot** (purchase + redemption). Importing CG alone typically yields **zero open quantity** after holding recompute. Open holdings require a separate holdings/CAS statement (out of scope).

Import envelope: `wealthDocuments` (contentHash dedupe) + `wealthEvidence` + Instruments + AssetTransactions.

Fixtures under `packages/parsers/src/__tests__/fixtures/kuvera/` are **anonymized** - never commit real `sample_data/` statements.

## Design rules

1. Evidence → Domain → Views; raw CAS/bank payloads do not leak into domain math.
2. Money is read-only from Wealth.
3. AssetTransaction is the source of truth for holdings.
4. Holdings are derived; never mutate Holdings directly.
5. Evidence never changes Holdings; mutations that write AssetTransactions do.
6. Portfolio is a computation, not an entity.
7. Cost basis is a strategy, not a forever average-cost assumption.
8. Transaction `type` = economic event; `executionType` = mechanism.
9. Use `quantity` (not `units`).
10. User-scoped Instruments are temporary; shared catalog is the goal.
11. Holding prices are provisional until price discovery exists.

## Extending to a new asset class

1. Add a discriminated instrument type (e.g. `StockInstrument`) - no metadata bag.
2. Reuse or extend economic `AssetTransactionType`s as needed.
3. Add cost-basis strategy if required (e.g. FIFO for equity).
4. Wire ingest evidence → AssetTransactions → holding recompute.
5. Portfolio computation stays unchanged.

## Code map

| Area | Path |
|------|------|
| Domain | `packages/domain/src/{instrument,asset-transaction,holding,portfolio,wealth-source}.ts` |
| Schema | `convex/schema.ts` (`instruments`, `wealthEvidence`, `assetTransactions`, `holdings`, `wealthDocuments`) |
| API | `convex/wealth.ts` |
| Holding recompute | `convex/lib/holdings.ts` |
| Kuvera CG ingest | `packages/readers` (xlsx), `packages/parsers/src/kuvera/*`, `packages/pipeline/parse-wealth-file.ts`, `bun run wealth parse` |
