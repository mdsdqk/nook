# Technical Specification — Statement Parsing CLI (v0.1)

## Overview

Build a CLI-first statement parsing system that can ingest bank statements from multiple sources (initially PDF), normalize them into a common schema, validate them, and persist them into Convex.

This project is intended to be the first reusable capability in the HF-FOS ecosystem. It should be designed as a collection of reusable libraries with a thin CLI application. Nothing in the parsing pipeline should depend on Convex, the CLI, or any UI framework.

The architecture should optimize for:

* Extensibility (adding new banks should be easy)
* Testability
* Separation of concerns
* Reusability by future API, workers and mobile/web apps

---

# Goals

The system should:

* Parse statements from multiple banks
* Support multiple statement formats
* Normalize all outputs into a common schema
* Validate parsed statements
* Persist parsed results into Convex
* Expose a developer-friendly CLI

The system should NOT:

* Perform accounting
* Categorize transactions
* Compute balances outside statement validation
* Integrate AI
* Support OCR (initially)

---

# Technology Stack

## Runtime

* Node.js 22+
* TypeScript
* pnpm workspaces

Reasoning:
Node provides the broadest compatibility across CLI, backend services, workers and future API applications.

---

## CLI

Prefer:

* commander

or

* cac

---

## PDF

Use a mature PDF text extraction library.

Avoid vendor-specific code in the reader layer.

---

## Database

Convex

Convex is an implementation detail.

No parser should import Convex directly.

---

# Monorepo Structure

```text
apps/

    cli/

packages/

    contracts/
    readers/
    detectors/
    parsers/
    normalizers/
    validators/
    persistence/
    shared/

convex/
```

---

# Responsibilities

## apps/cli

Contains only CLI logic.

Responsible for:

* parsing CLI arguments
* invoking services
* displaying progress
* pretty-printing output

Must NOT contain:

* parsing logic
* Convex logic
* validation logic

---

## packages/contracts

Defines shared domain models.

Example:

```text
Document
ParsedStatement
ParsedTransaction
StatementMetadata

Interfaces:

Reader
Detector
StatementParser
Validator
PersistenceAdapter
```

Everything else depends on this package.

Nothing inside this package depends on anything else.

---

## packages/readers

Responsible for converting external document formats into an intermediate representation.

Initially support:

* PDF

Future:

* CSV
* XLSX
* HTML
* OCR

Example

```text
PDF

↓

ParsedDocument
```

Readers should never understand bank formats.

They only understand document formats.

---

## packages/detectors

Responsible for determining:

* bank
* account type
* statement format/version

Input

ParsedDocument

Output

```text
Bank:
HDFC

Type:
Savings

Version:
2024-v2
```

No parsing happens here.

---

## packages/parsers

Contains bank-specific parsers.

Example

```text
hdfc/

    savings.ts

    credit-card.ts

icici/

    savings.ts
```

Each parser implements:

```ts
StatementParser
```

Parsers should:

* extract metadata
* extract balances
* extract transactions

Return

```text
ParsedStatement
```

Parsers must never:

* persist
* validate
* normalize merchants

---

## packages/normalizers

Responsible for data normalization.

Examples:

Merchant names

```
AMAZON SELLER SERVICES
↓

Amazon
```

Dates

```
31/12/2025

↓

2025-12-31
```

Narrations

Whitespace cleanup

Reference extraction

Amount normalization

Future:

* merchant canonicalization
* UPI extraction
* payment rail detection

---

## packages/validators

Responsible for validating parsed statements.

Three categories.

### Structural

* required fields
* dates parse
* balances exist

### Financial

Verify

Opening

*

Credits

*

Debits

=

Closing

### Semantic

Examples

* transaction dates within statement period
* no duplicate references
* balances present

Validators return structured validation results.

Never throw exceptions for validation failures.

---

## packages/persistence

Persistence adapters.

Initially:

Convex

Later:

* PostgreSQL
* JSON
* CSV

Expose

```text
saveStatement()

saveTransactions()
```

Nothing else.

---

## packages/shared

General utilities.

Examples

* logging
* file helpers
* string utilities
* date helpers

No business logic.

---

# Parsing Pipeline

```text
Document

↓

Reader

↓

ParsedDocument

↓

Detector

↓

Parser

↓

ParsedStatement

↓

Normalizer

↓

Validator

↓

Persistence

↓

Result
```

Each stage should be independently testable.

---

# ParsedStatement Model

Minimum model

```ts
interface ParsedStatement {

    metadata

    openingBalance

    closingBalance

    transactions

}
```

Metadata should include:

* bank
* account type
* account number
* statement period
* currency

Transactions should include:

* date
* narration
* debit
* credit
* balance
* reference
* sequence number

---

# CLI Commands

## Parse

```bash
statement parse statement.pdf
```

Pipeline

* read
* detect
* parse
* normalize
* validate
* persist

Output

```
✓ Detected HDFC Savings

✓ Parsed 182 transactions

✓ Validation passed

✓ Stored in Convex
```

---

## Detect

```bash
statement detect statement.pdf
```

Output

```
Bank:
HDFC

Type:
Savings
```

---

## Validate

```bash
statement validate statement.pdf
```

Output

```
Structural
PASS

Financial
PASS

Semantic
PASS
```

---

## Parse Folder

```bash
statement parse ./statements
```

Recursively parses every supported file.

---

# Error Handling

Never crash on malformed statements.

Return structured errors.

Examples

```text
UnknownBank

UnsupportedStatementVersion

CorruptPDF

ValidationFailure

PersistenceFailure
```

---

# Logging

Every stage should emit logs.

Example

```
Reading document...

Detecting statement...

Using parser:

HDFC Savings v2

Normalizing...

Validating...

Persisting...
```

---

# Testing Strategy

Each package should have isolated unit tests.

Reader tests

* can read PDFs

Detector tests

* detects correct bank

Parser tests

* parses known fixtures

Validator tests

* catches incorrect balances

Normalizer tests

* canonicalizes merchant names

Persistence tests

* mocks Convex

End-to-end tests should parse real fixture statements.

---

# Fixtures

Create

```
fixtures/

    hdfc/

        savings/

            sample1.pdf

            expected.json

        credit-card/

    icici/
```

Every parser should have golden test fixtures.

---

# Non-functional Requirements

* Fully typed
* No circular dependencies
* Pure parser implementations
* Deterministic output
* Idempotent persistence
* Support processing thousands of statements in batch mode
* Easy to add new banks without modifying existing parsers

---

# Future Extensions (Out of Scope)

* OCR
* AI-assisted parsing
* Password-protected PDFs
* Email ingestion
* Queue-based workers
* REST API
* Statement version migration
* Transaction categorization
* Merchant intelligence
* Multi-currency support

These should be enabled by the architecture but not implemented in this iteration.
