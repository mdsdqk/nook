# Nook hosted MCP

Nook exposes statement ingest + ledger/wealth tools over **Streamable HTTP** so Claude, ChatGPT, Cursor, and other assistants can connect as remote MCP clients.

## Architecture

| Piece | Role |
|-------|------|
| `apps/mcp` | OAuth 2.1 AS + resource server, MCP tools, PDF/XLSX parse (Railway / Bun) |
| `apps/spiky` | Login + `/oauth/consent` UI (swap to `apps/web` later via `AUTH_UI_PUBLIC_URL`) |
| `convex` | Users, ledger, wealth, MCP OAuth clients/codes/tokens |

Identity lives in Convex. Spiky is only the browser consent host - not the source of truth.

## In-app Assistants (Spiky)

Signed-in users get a connect recipe at **`/assistants`** (primary nav **Assistants**, also linked from Settings → Assistants and a quiet login footnote).

- Shows `VITE_MCP_URL` + `/mcp` with copy (errors if `VITE_MCP_URL` is unset - no silent localhost fallback on that page).
- Claude / ChatGPT custom-connector steps; leave OAuth client id/secret blank (DCR).
- Production Spiky (Vercel) must set `VITE_MCP_URL` to the public HTTPS MCP origin (same host used for consent approve).

## Local run

1. Start Convex (`bun run dev:convex`) and export `CONVEX_URL`.
2. Start Spiky with Convex URL + MCP URL:

```bash
# apps/spiky/.env.local
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
VITE_SITE_URL=http://127.0.0.1:5174
VITE_MCP_URL=http://127.0.0.1:8787
```

```bash
bun run dev:spiky
```

3. Start MCP:

```bash
cd apps/mcp
# or from repo root:
set CONVEX_URL=https://your-deployment.convex.cloud
set CONVEX_SITE_URL=https://your-deployment.convex.site
set MCP_PUBLIC_URL=http://127.0.0.1:8787
set AUTH_UI_PUBLIC_URL=http://127.0.0.1:5174
set MCP_CONSENT_SECRET=local-dev-secret-at-least-16
bun run dev:mcp
```

Health: `GET http://127.0.0.1:8787/health`

## Connect Claude / ChatGPT

Preferred path for humans: Spiky **Assistants** (`/assistants`) - copy the MCP URL and follow the steps there.

Operator checklist:

1. Sign in to Spiky (Better Auth - Google or username/email).
2. Open **Assistants** (or Settings → Assistants).
3. In Claude: **Settings → Connectors → Add custom connector** (or ChatGPT custom MCP) → paste `https://<mcp-host>/mcp`.
4. Leave OAuth Client ID / Secret blank.
5. Browser opens Spiky `/oauth/consent` (skips login if already signed in).
6. Click **Allow access** → MCP verifies the Better Auth session token, mints an auth code → return to the assistant → tools appear.

OAuth endpoints (discovery):

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /register` (DCR)
- `GET /authorize` → redirects to Spiky consent
- `POST /token`
- `POST /mcp` (Bearer access token)

## Tools

**Ingest (always persist)**

- `detect_statement` - detect only (no write)
- `parse_statement` - parse → Convex upsert → ledger sync
- `parse_wealth_kuvera` - Kuvera XLSX → Convex wealth upsert

File inputs: `filename` + `fileBase64` **or** `fileUrl`.

**Money / wealth**

- `list_accounts`, `list_transactions`, `list_statements`, `list_unsynced`
- `sync_ledger`, `sync_transfers`, `cashflow_timeline`
- `list_instruments`, `list_holdings`, `get_portfolio`
- `create_manual_instrument`, `record_manual_asset_transaction`

## Automation loop

Assistants own file acquisition (email/Drive/filesystem). Nook owns parse + books:

1. Assistant finds a statement PDF.
2. Calls `parse_statement` with bytes/URL.
3. Later answers questions via `list_accounts` / `cashflow_timeline` / `get_portfolio`.

## Railway deploy

Dockerfile: [`apps/mcp/Dockerfile`](../../apps/mcp/Dockerfile), Railway config: [`apps/mcp/railway.toml`](../../apps/mcp/railway.toml).

Required env on the service:

- `CONVEX_URL`
- `CONVEX_SITE_URL` - Better Auth HTTP origin (`.convex.site`); used to exchange Spiky session tokens on `/approve`
- `MCP_PUBLIC_URL` - public HTTPS origin of the MCP service (no trailing slash)
- `AUTH_UI_PUBLIC_URL` - public Spiky (or future web) origin
- `MCP_CONSENT_SECRET` - long random secret used to HMAC consent tickets (required in production)
- `MCP_SERVER_SECRET` - shared with Convex (`bunx convex env set MCP_SERVER_SECRET`); gates `mcpOauth` / `mcpApi` calls
- `PORT` - usually set by Railway (`8787` in Dockerfile)

Optional:

- `MCP_DCR_SHARED_SECRET` - when set, `POST /register` requires `Authorization: Bearer <secret>`
- `MCP_ALLOW_OPEN_DCR` - default `false`; set `true` only for local unauthenticated DCR (also enables a fixed dev `MCP_SERVER_SECRET` fallback)
- `MCP_REFRESH_TOKEN_TTL_SEC`, `MCP_ACCESS_TOKEN_TTL_SEC`, `MCP_AUTH_CODE_TTL_SEC`
- `MCP_RATE_LIMIT_MAX` / `MCP_RATE_LIMIT_WINDOW_MS`
- `MCP_ALLOW_LOCALHOST_REDIRECTS` - default `true` for local Claude OAuth redirects

### Security notes

- `/authorize` stores a signed consent ticket server-side and redirects Spiky with an opaque `consent_id` (ticket never appears in the browser URL).
- `/approve` requires that `consent_id` plus a Better Auth `session_token` from Spiky (exchanged for a Convex JWT to resolve the app user). Granted scopes cannot exceed the authorize-time ceiling.
- Dynamic client registration is fail-closed unless `MCP_DCR_SHARED_SECRET` or `MCP_ALLOW_OPEN_DCR=true`.
- Convex `mcpOauth` mutations and `mcpApi` require `MCP_SERVER_SECRET`; token expiry uses Convex server time (not client-supplied clocks).
- Tool data access goes through `convex/mcpApi.ts`, authenticated by MCP access-token hash (assistants do not hold Better Auth JWTs).
- `fileUrl` tool inputs resolve DNS and block private/link-local answers (SSRF / rebinding guard).
- Tools enforce OAuth scopes: `nook.read` vs `nook.write`.
- Refresh tokens are rotated on use; PKCE is verified before authorization codes are consumed.

After deploy, point Spiky `VITE_MCP_URL` at the Railway MCP origin.

## Directory listing (ops track)

Custom connectors work today. Curated Claude / ChatGPT directories are a **separate review track** - not required for `/assistants` UI.

Prep before submit:

1. Stable production HTTPS MCP + Spiky consent origins (`MCP_PUBLIC_URL`, `AUTH_UI_PUBLIC_URL`, `VITE_MCP_URL`).
2. Tool annotations on every tool (`title`, `readOnlyHint`, `destructiveHint`, `openWorldHint`) in `apps/mcp/src/tools/register.ts`.
3. Public privacy policy, terms, support URL, logo / listing copy (frame as personal books/ingest - not money transfer).
4. MFA-free reviewer demo account with sample ledger/wealth data.
5. OpenAI: identity verification + `/.well-known/openai-apps-challenge` on the MCP (or parent) host.
6. Claude: Team/Enterprise org with Directory submission access.

References:

- Claude: [Connectors directory submission](https://claude.com/docs/connectors/building/submission), [directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- OpenAI: [Submit plugins](https://developers.openai.com/plugins/deploy/submission)

Keep in-app copy on **custom connector** until a listing is live.

## Spiky → apps/web later

Move `/login` + `/oauth/consent` to `apps/web` and set `AUTH_UI_PUBLIC_URL` to the new origin. Keep `MCP_PUBLIC_URL` stable so existing Claude connections do not need re-auth (until tokens expire).
