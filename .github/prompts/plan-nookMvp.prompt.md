# Plan: Nook MVP - Full Implementation Plan

Build the Nook MVP using **Convex** (backend), **Vite + React + React Router** (web), and **Expo** (mobile) in a turborepo. Domain types (account/transaction types) live as **hierarchical type registries in code** - not DB tables. The MVP covers: user onboarding, account management, transactions, balance assertions, cashflow vs. spending differentiation, and a dashboard with time-scoped analytics.

## Key Decisions

- **Web:** Vite + React + React Router v7 (replacing Next.js - Convex is client-first reactive, no SSR benefit)
- **Types:** Hierarchical string union + registry in `@nook/domain`. Adding subtypes = one registry entry + one validator update. No DB tables for types.
- **Auth:** Skipped - username-based lookup, userId in localStorage/AsyncStorage
- **UI:** shadcn/ui + Tailwind v4 (web), React Native Paper (mobile)
- **Namespace:** `@nook/*` everywhere
- **Convex layout:** Function files at `convex/` root (not `convex/src/` - Convex requires this)

---

## Phase 0: Init Commit Scaffold

| Step | What | Parallel? |
|------|------|-----------|
| **0.1** | Fix package naming: `@hf-fos/domain` → `@nook/domain` in `convex/package.json` and `convex/tsconfig.json` | - |
| **0.2** | Restructure Convex dir: delete `convex/src/`, put files at `convex/` root, create `convex/schema.ts` stub | - |
| **0.3** | Replace Next.js with Vite + React in `apps/web/`: remove Next.js files + `app/` dir, create `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, stub routes under `src/routes/` | Parallel w/ 0.5 |
| **0.4** | Add shadcn/ui + Tailwind v4 to web: `src/index.css`, `src/lib/utils.ts`, `components.json`, install initial shadcn components | Part of 0.3 |
| **0.5** | Initialize Expo mobile app with Expo Router, tab layout, `package.json` as `@nook/mobile` | Parallel w/ 0.3 |
| **0.6** | Create missing `packages/domain/src/index.ts`, stub all domain files | - |
| **0.7** | Update `turbo.json` for Vite/Expo/Convex dev tasks, update `.gitignore` | - |

**Checkpoint:** `bun install` works, `bun run typecheck` passes, Vite app loads, Expo starts.

---

## Phase 1: Core Domain Types & Logic (`@nook/domain`)

| Step | What | Key Design |
|------|------|------------|
| **1.1** | Account type registry in `account.ts` | `AccountType` string union + `ACCOUNT_TYPE_REGISTRY` with `{ label, parent, isAsset, isLiability }` per type. Helpers: `isAssetType()`, `isLiabilityType()`, `getSubtypes()`, `getParentType()`. Subtypes use dot notation: `"investment.epf"` |
| **1.2** | Transaction type registry in `transaction.ts` | `TransactionType` union + `TRANSACTION_TYPE_REGISTRY` with `{ label, direction, affectsNetWorth }`. Helper: `requiresDestinationAccount()` |
| **1.3** | Balance assertion type in `assertion.ts` | `BalanceAssertion`: accountId, date, balance (signed) |
| **1.4** | Cashflow classification in `cashflow.ts` | `isSpending()` (only expense), `isCashflowOut()` (expense/obligation/transfer), `isCashflowIn()` (income), `classifyForDashboard()`. Spending = irreversible consumption only. |
| **1.5** | Balance computation in `balance.ts` | `computeAccountBalance(assertions, txns, asOfDate)` - sorts assertions, finds last before date, sums txn deltas after it, snaps to assertion. `computeTransactionEffect(tx, accountId)` - signed amount relative to account. `computeNetWorth()` |
| **1.6** | Re-export everything from `index.ts` | - |

**Checkpoint:** Typecheck passes. Unit tests for balance computation (assertion snapping, backdated txns, gaps).

---

## Phase 2: Convex Backend

| Step | What | File |
|------|------|------|
| **2.1** | Schema: 4 tables (`users`, `accounts`, `transactions`, `balanceAssertions`) with indexes. Type fields use `v.union(v.literal(...))` - extending later = add one literal. | `convex/schema.ts` |
| **2.2** | User functions: `create` (uniqueness check), `getByUsername`, `get` | `convex/users.ts` |
| **2.3** | Account CRUD: `create` (with optional initial balance assertion), `list` (with computed balances), `get` (detail), `update`, `remove` | `convex/accounts.ts` |
| **2.4** | Transaction CRUD: `create` (validation: amount>0, transfer needs toAccountId, backdating OK), `list` (filters: date range, account, type), `get`, `remove` | `convex/transactions.ts` |
| **2.5** | Balance assertions: `assert` (upsert for account+date), `list` (sorted by date) | `convex/assertions.ts` |
| **2.6** | Dashboard queries: `summary` (totals, spending by category, net worth), `cashflowTimeline` (bucketed by daily/weekly/monthly) - uses `@nook/domain` for classification | `convex/dashboard.ts` |

**Checkpoint:** `convex dev` deploys. Test via Convex dashboard UI: full user flow.

---

## Phase 3: Web - Wiring & Onboarding

| Step | What |
|------|------|
| **3.1** | Convex provider in `src/lib/convex.ts`, wrap in `App.tsx` |
| **3.2** | React Router route structure: `/` (onboarding), `/dashboard` (layout with sidebar + time scope), nested routes for accounts/transactions |
| **3.3** | User context (`src/lib/user-context.tsx`): reads userId from localStorage, exposes login/register/logout. Onboarding page: name + username form → create user → redirect to dashboard |

**Checkpoint:** Onboarding works, localStorage persists login across refresh.

---

## Phase 4: Web - Core Features (parallel with Phase 5)

| Step | What |
|------|------|
| **4.1** | Dashboard layout: sidebar nav, time-scope selector (week/month/year/custom in URL params), content outlet |
| **4.2** | Accounts: list (cards with type badge, balance), create form (name, type select from registry, currency, initial balance), detail (balance, assertions, recent txns, "assert balance" action) |
| **4.3** | Transactions: create form (type, date picker defaulting to today, amount, account select, to-account if transfer, category, description), list with filters (date, type, account) |
| **4.4** | Dashboard analytics: summary cards (income, spending, net cashflow, net worth), spending by category chart, cashflow timeline chart. Uses **Recharts**. |

---

## Phase 5: Mobile (Expo) - parallel with Phase 4

| Step | What |
|------|------|
| **5.1** | Convex provider + login screen (username → AsyncStorage) |
| **5.2** | Dashboard tab (summary cards + time scope), Accounts tab (FlatList + FAB), Add Transaction tab |
| **5.3** | Account detail, transaction list with filters |

**Mobile and web share the same Convex backend - real-time sync.**

---

## Verification

1. `bun install` + `bun run typecheck` pass across all workspaces
2. `bun run dev:web` → Vite on :5173, `bun run dev:mobile` → Expo, `bun run dev:convex` → schema deploys
3. Domain unit tests: `computeAccountBalance` handles no-assertion, single, multiple, backdated, gap cases
4. Onboarding → create user → dashboard → persists on refresh
5. Create bank/CC/wallet accounts → list shows correct types + balances
6. Add expense → spending total changes; add transfer → spending unchanged, cashflow view shows it
7. Backdated expense → correct month updates
8. Assert balance → account snaps to it → future = assertion + later txns
9. Net worth = Σ(assets) - Σ(liabilities); transfers excluded from spending
10. Mobile shows same data in real-time

---

## Implementation Order

```
Phase 0 (scaffold)          → commit
    ↓
Phase 1 (domain types)      → commit
    ↓
Phase 2 (Convex backend)    → commit
    ↓
Phase 3 (web wiring)  ──┬── Phase 5 (mobile)
    ↓                    │
Phase 4 (web features) ──┘  → commit
```

Phases 4 and 5 run in parallel - same backend, different UIs. Each phase is independently verifiable before moving on.

---
