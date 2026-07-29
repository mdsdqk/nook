# AGENTS.md

## Cursor Cloud specific instructions

Nook is a Bun + Turborepo monorepo (Node >= 20, `packageManager: bun`). Standard commands live in the root `README.md` and per-package `package.json` scripts; only the non-obvious caveats are captured here.

### Toolchain / setup
- The package manager is **Bun**, and it is **not** on the base VM image. The startup update script installs it to `~/.bun` and runs `bun install`. The Bun installer adds `~/.bun/bin` to `~/.bashrc`; in a fresh non-login shell you may need to invoke Bun as `~/.bun/bin/bun` or add it to `PATH`.

### The functional product: the statement-parsing CLI
- The only fully-implemented product is the CLI (`apps/cli`). Run it from the repo root: `bun run statement <detect|validate|parse> <pdf-or-dir>` (see `docs/tech/cli-parsing.md`). `parse` supports `--out <dir>` (JSON), `--convex`, and `--sync-ledger --user <name>`.
- **Bank statement PDFs are not in the repo.** `sample_data/` is gitignored and empty on a fresh checkout. The CLI and `packages/pipeline`'s `parse-file.test.ts` need real PDFs at `sample_data/savings/*.pdf`; without them those pipeline tests fail (`READ_ERROR` / `UNKNOWN_BANK`). All other package unit tests use synthetic in-memory documents and pass. To smoke-test the pipeline without real statements, you can generate a synthetic HDFC-format PDF with `@libpdf/core` (a `packages/readers` dependency) whose extracted lines match the format in `packages/parsers/src/__tests__/hdfc-savings.test.ts`.

### Testing caveats
- `bun run test` (turbo) **aborts early**: several packages declare `test: vitest run` but contain no test files, and Vitest exits 1 on "No test files found". To run the real suites, run per package, e.g. `cd packages/parsers && bunx vitest run` (packages with tests: `parsers`, `detectors`, `validators`, `shared`, `persistence`, `domain`, `pipeline`).
- `bun run lint` only runs in `@repo/ui` (the sole package with a `lint` script).

### Convex backend (optional)
- Convex is only needed for the CLI's `--convex` / `--sync-ledger` paths. Start it in anonymous agent mode (no login): `cd convex && CONVEX_AGENT_MODE=anonymous bunx convex dev`. This provisions a local deployment at `http://127.0.0.1:3210` and writes `convex/.env.local`.
- The CLI reads `CONVEX_URL` from the process env and does **not** auto-load `convex/.env.local`; export `CONVEX_URL=http://127.0.0.1:3210` before running CLI Convex commands.
- `convex dev` may print a benign `Filesystem changed during push, retrying...` loop; functions still become ready and mutations succeed. It also creates an untracked boilerplate `convex/README.md` — do not commit it.

### Known pre-existing issues on `main` (not environment problems)
- `@nook/cli` typecheck fails: `apps/cli/src/commands/parse.ts` imports `ConvexWritePayload`, which `@nook/persistence` no longer exports, plus an implicit-`any` parameter. Bun runs the CLI fine regardless (types are stripped at runtime), so all CLI commands still work.
- One `packages/validators` test fails (`StatementValidator > fails when no transactions`).

### Web / mobile
- `apps/web` (`bun run dev:web`, Vite on port 5173) and `apps/mobile` (`bun run dev:mobile`, Expo) are scaffolds: stub pages with routing but no backend wiring yet.
- `apps/spiky` (`bun run dev:spiky`, Vite on port 5174) is a blank React playground for spikes and POCs before promoting ideas into `apps/web`.
