# AGENTS.md

## Cursor Cloud specific instructions

Nook is a Bun + Turborepo monorepo (Node >= 20, `packageManager: bun`). Standard commands live in the root `README.md` and per-package `package.json` scripts; only the non-obvious caveats are captured here.

### Toolchain / setup
- The package manager is **Bun**, and it is **not** on the base VM image. The startup update script installs it to `~/.bun` and runs `bun install`. The Bun installer adds `~/.bun/bin` to `~/.bashrc`; in a fresh non-login shell you may need to invoke Bun as `~/.bun/bin/bun` or add it to `PATH`.

### The functional product: the statement-parsing CLI
- The only fully-implemented product is the CLI (`apps/cli`). Run it from the repo root: `bun run statement <detect|validate|parse> <pdf-or-dir>` (see `docs/tech/cli-parsing.md`). `parse` supports `--out <dir>` (JSON), `--convex`, and `--sync-ledger`.
- Convex writes require prior CLI login: `bun run statement auth login` (opens Spiky, stores session under `~/.config/nook/credentials.json`). Then `--convex` / `--sync-ledger` use that identity - there is no `--user` flag.
- **Hosted MCP** (`apps/mcp`, see `docs/tech/mcp.md`): Streamable HTTP + OAuth 2.1; Spiky hosts `/oauth/consent`. Run with `bun run dev:mcp` (`CONVEX_URL`, `CONVEX_SITE_URL`, `MCP_PUBLIC_URL`, `AUTH_UI_PUBLIC_URL`, `MCP_CONSENT_SECRET`, `MCP_SERVER_SECRET` - same secret via `bunx convex env set MCP_SERVER_SECRET`; for local unauthenticated DCR set `MCP_ALLOW_OPEN_DCR=true`).
- **Bank statement PDFs are not in the repo.** `sample_data/` is gitignored and empty on a fresh checkout. The CLI and `packages/pipeline`'s `parse-file.test.ts` need real PDFs at `sample_data/savings/*.pdf`; without them those pipeline tests fail (`READ_ERROR` / `UNKNOWN_BANK`). All other package unit tests use synthetic in-memory documents and pass. To smoke-test the pipeline without real statements, you can generate a synthetic HDFC-format PDF with `@libpdf/core` (a `packages/readers` dependency) whose extracted lines match the format in `packages/parsers/src/__tests__/hdfc-savings.test.ts`.

### Testing caveats
- `bun run test` (turbo) **aborts early**: several packages declare `test: vitest run` but contain no test files, and Vitest exits 1 on "No test files found". To run the real suites, run per package, e.g. `cd packages/parsers && bunx vitest run` (packages with tests: `parsers`, `detectors`, `validators`, `shared`, `persistence`, `domain`, `pipeline`).
- `bun run lint` only runs in `@repo/ui` (the sole package with a `lint` script).

### Auth (Better Auth + Convex)
- Auth is **Better Auth** via `@convex-dev/better-auth`. Google OAuth is primary; email/password (+ username plugin) is secondary (`requireEmailVerification: false` for now). Sign-up requires username + email; sign-in accepts username or email.
- Scaffold: `convex/convex.config.ts`, `convex/auth.config.ts`, `convex/auth.ts`, `convex/http.ts`. Domain users live in `users` (`authSubject`, `email`, `name`, optional `username`) linked from `ctx.auth.getUserIdentity().tokenIdentifier`.
- **Fresh start:** pre-Better-Auth username-only users are gone. Clear old `users` / dependent data (or use a fresh deployment) and re-import statements after logging in.
- Convex deployment env (set with `bunx convex env set`, not `.env.local`):
  - `BETTER_AUTH_SECRET` - random secret
  - `SITE_URL` - Spiky origin, e.g. `http://localhost:5174` (loopback hosts on the same port are auto-trusted: `localhost`, `127.0.0.1`, `[::1]`)
  - `TRUSTED_ORIGINS` - optional comma-separated extra origins for LAN/test machines, e.g. `http://192.168.1.20:5174`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - required for Google sign-in
- Google Cloud OAuth Web client redirect URI: `https://<deployment>.convex.site/api/auth/callback/google` (needs a real `.convex.site` URL; email/password works without Google).
- **Same email, Google after password:** account linking is enabled with `trustedProviders: ["google"]`. Signing in with Google using an email that already has a password account links Google to that Better Auth user (same app user after `ensureCurrentUser`). Prefer separate OAuth clients for dev vs prod.
- Spiky (`apps/spiky/.env.local`): `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL` (`.site`), `VITE_SITE_URL=http://localhost:5174`, `VITE_MCP_URL` (MCP origin for consent + Assistants). See `apps/spiky/.env.example`.
- CLI: `bun run statement auth login|logout|status`. Optional `NOOK_SPIKY_URL` (default `http://localhost:5174`). Optional `NOOK_SPIKY_ALLOWED_ORIGINS` (comma-separated extra callback Origins; loopback equivalents of `NOOK_SPIKY_URL` are always allowed). Session token is stored; Convex JWTs are refreshed from `/api/auth/convex/token`.

### Convex backend (optional)
- Convex is needed for Spiky auth/data and the CLI's `--convex` / `--sync-ledger` paths. Prefer a normal cloud/dev deployment for Google OAuth. Anonymous agent mode: `cd convex && CONVEX_AGENT_MODE=anonymous bunx convex dev` (email/password can work; Google redirect needs `.convex.site`).
- The CLI reads `CONVEX_URL` from the process env (or from saved credentials) and does **not** auto-load `convex/.env.local`; export `CONVEX_URL` before running CLI Convex commands if it differs from the credential file.
- `convex dev` may print a benign `Filesystem changed during push, retrying...` loop; functions still become ready and mutations succeed. It also creates an untracked boilerplate `convex/README.md` - do not commit it.
- **Production deploy:** see [docs/tech/deploy.md](docs/tech/deploy.md). `SITE_URL` must be the **Spiky** origin (`https://spiky.nook.com` or the Vercel Spiky URL). Root script: `bun run deploy:convex`. Vercel: two projects (`apps/web` → primary hostname, `apps/spiky` → playground). Published CLI: `bunx nook` / `npx nook` (`bun run build:cli` / `bun run publish:cli`).

### Known pre-existing issues on `main` (not environment problems)
- One `packages/validators` test fails (`StatementValidator > fails when no transactions`).

### Web / mobile
- `apps/web` (`bun run dev:web`, Vite on port 5173) and `apps/mobile` (`bun run dev:mobile`, Expo) are scaffolds: stub pages with routing but no backend wiring yet.
- `apps/spiky` (`bun run dev:spiky`, Vite on port 5174) is the React playground with Better Auth (Google + username/email), money UI spikes, **MCP Assistants** (`/assistants`), and **MCP OAuth consent** (`/oauth/consent`) before promoting into `apps/web`.
