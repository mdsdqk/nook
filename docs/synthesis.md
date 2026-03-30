**Nook - HF-FOS Outline**  
**Nook is a Human-First Financial Operating System**  
**Canonical Model: Balance Assertions + Explanatory Transactions**  
**(March 2026 – Cleaned & Restructured)**

### 0. Executive Summary 

nook is a time-aware personal financial operating system designed to:  
- Represent financial reality truthfully at all granularities  
- Preserve accounting correctness without exposing accounting complexity  
- Separate choice, obligation, risk, and optimization  
- Scale from daily transaction capture to lifetime financial insight  
- Reduce anxiety by design, not by omission  

nook is **not**: an expense tracker, rewards maximizer, gamified app, or behavioral nudging system - although it does each of these, it is not pushing behaviours to extremeties.

nook **is**: a ledger-backed truth engine, an instrument governance system, and a zoomable financial map of a human life.

### 1. Core Design Philosophy (Non-Negotiable)

#### 1.1 Human Reality > Accounting Formalism  
Users record **what they experienced**. The system derives **economic truth** internally. Dashboards translate between user cashflow thinking and internal balance-sheet logic.

#### 1.2 Separation of Concerns (Foundational)  
Every financial event is classified into **exactly one** of:  
1. Consumption (Expense)  
2. Ownership Change (Asset/Liability movement)  
3. Risk Transfer (Insurance)  
4. Instrument Metadata (Rewards, perks, loyalty)  
5. Valuation Change (Market movement)  

Mixing categories creates confusion and anxiety.

### 2. Fundamental Financial Primitives 

**Primitives**  
- Asset, Liability, Expense, Income, Transfer, Revaluation  

**Net Worth Invariant** (must always hold)  
Net Worth = Σ(Assets) – Σ(Liabilities)  
- Expenses reduce net worth  
- Income increases net worth  
- Transfers & internal movements do **not** affect net worth  
- Revaluations affect net worth without cashflow  

Violation = system error.

### 3. Canonical Model – Balance Assertions & Explanatory Transactions  
**(This replaces the old “Time-Aware Ledger Model” – the new foundation)**

#### 3.1 Core Acceptance  
The system might **never** have a complete or deterministic ledger of reality — and that is intentional and kind. Users forget, batch-enter, overwrite balances, and partially backfill. Completeness is never guaranteed.

#### 3.2 Two Kinds of Truth (Both User Assertions)  
1. **State Truths** – Balance Assertions  
   Account A | As of date D | Balance = X (declared by user)  
   These are **ground truth**. Non-derivable. Authoritative. Sparse over time.

2. **Event Truths** – Transactions  
   Claimed financial events (timestamped by economic date).  
   Used **only** for reporting, analysis, and explanation.  
   Optional, partial, backfillable. Never allowed to contradict asserted balances.

#### 3.3 Ledger Role (Explanatory Substrate Only)  
Ledger ≠ source of truth  
Ledger = stories that try to explain changes between assertions  
Balances = user-declared checkpoints

#### 3.4 Balance Computation Rule (Final, Simplified)  
1. Sort all Balance Assertions by date  
2. For each interval between consecutive assertions:  
   - Start with the prior asserted balance (fixed)  
   - Apply only the transactions recorded in that interval to compute deltas (for reporting)  
3. At the next assertion date:  
   - Snap to the user-asserted balance  
   - Ignore any mismatch (no phantom entries, no forced reconciliation)  

Balances are always shown in UI as:  
**“Balance as last confirmed on [DATE] + Σ(Txns recorded after said [DATE])”**  

#### 3.5 Historical Integrity  
- Inserting a transaction in the past affects only future reports in its interval  
- Assertions remain untouched  
- Today’s balance always reflects the latest asserted checkpoint (or interpolation from the most recent one)

This model eliminates backdated confusion forever.

### 4. Transaction Model (Updated for Canonical Model)

#### 4.1 User-Facing Transaction Types  
- Income  
- Expense  
- Transfer  
- Obligations - CashflowOut (obligatory outflow experienced as one payment)  

Users never see internal decomposition unless requested.

#### 4.2 Composite Transactions (Internal Only)  
Single user experience → multiple atomic effects (hidden by default).  
Examples: EMI, ULIP premium, Employer PF contribution.  
System accepts **one** user entry; decomposes internally where needed; respects assertions.

### 5. Spending (Consumption Truth) 

**What counts**: irreversible consumption (food, rent, utilities, travel, discretionary).  
**What never counts as spending**: investments, SIPs, wallet loads, CC bill payments, loan principal, asset reallocations, insurance premiums.  
Spending analytics reflect **lifestyle**, not responsibility.

### 6. Transfers (Movement Without Judgment) (Unchanged + Visibility Rule)

**Subtypes** (internal): LiquidMovement, DebtSettlement, InvestmentAllocation, InternalAdjustment.  
Transfers are always recorded but **hidden by default** in spend dashboards; surfaced only for specific questions. A secondary cashflow dashboard shall be available to look at money movement details.

### 7–10. Instrument-Specific Rules (Lightly Updated for Model Consistency)

**7. Credit Cards** – Liability, not spending category. Card purchase = Expense; Bill payment = Transfer. Rewards = metadata only.

**8. Loans & EMIs** – EMI is first-class Obligation/CashflowOut to user. Internal split (principal = Transfer, interest = Expense) shown **only** in Debt Intelligence view.

**9. Investments** – Contributions = Transfer; Market moves = Revaluation (orthogonal to cashflow). Details shown only in Wealth Intelligence View.

**10. Insurance** – Pure Expense (Risk Protection). Excluded from lifestyle spending. ULIP = Composite (Expense + Transfer). Although, with ULIP being a bad investment category anyways, we shall not focus too much on it and focus only on pure insurance products and risk protection in the Risk View.

**Presentation Rule**: Obligations & risk protection should never pollute lifestyle or spending views.

### 11. Savings Metrics (Correct Definitions) 

- **True Savings Rate** = (Income – Expenses) / Income → consumption discipline  
- **Investment Allocation Rate** = Investment Transfers / Income → wealth direction  
Metrics must never be merged.

### 12–18. Governance & Intelligence Layers 

- Credit Cards as Instruments (viability, fees, benefits, complexity)  
- Rewards & Loyalty (metadata only; audit-only reconciliation; strictly bounded alerts)  
- Statement Reconciliation Engine (completeness & trust, not optimization)  
- Card Renewal & Viability Intelligence (KEEP / REVIEW / CLOSE)  
- Milestones & Thresholds (timing influence only; no quantity nudge; neutral language)  
- Loyalty Programs

**Explicit “SHALL NOT” List** – no recommendations, no gamification, no guilt.

### 19. Multi-Scale Views (Zoom Architecture) 

- Daily → Cashflow reality  
- Monthly → Lifestyle & obligations  
- Yearly → Net worth & direction  
- Lifetime → Liquidity, risk, optionality  

### 20. Financial Health Map (Canonical Output) 

Five pillars:  
1. Cashflow Health  
2. Risk Protection  
3. Liquidity  
4. Net Worth Direction  
5. Optionality  

The system **answers questions** — it never issues commands.

### 21. System Invariants (Must Always Hold)

1. Net worth identity holds  
2. Assertions are never contradicted  
3. Transactions explain but never override assertions  
4. Obligations do not pollute lifestyle spending  
5. Rewards never drive behavior  
6. User intent always respected  
7. Historical snapshots remain reproducible between assertions  

### 22. Final Design Ethos (Anchor)

Clarity over cleverness. Truth over tactics. Human calm over optimization.  

nook is successful when:  
- Users trust the numbers
- Retrospection and Introspection is easy to do. User should be able to open the app and analyse their financial behaviour and health easily
- Anxiety decreases over time  
- Decisions feel intentional, not reactive  

### Closing Note

This specification defines a system that remains **correct under time, stress, complexity, and growth** — not because it tracks everything, but because it tracks **only what matters, in the right way, at the right time**.  

**One sentence that locks everything in**:  
**Balances are truths the user declares. Transactions are stories that try to explain them.**

---
