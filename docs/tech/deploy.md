# Deploying Nook

Production layout:

| Surface | Role | Hostname |
|---------|------|----------|
| `apps/web` | Primary product (scaffold today) | `nook.com` or Vercel URL until DNS |
| `apps/spiky` | Unlisted auth + money playground | `spiky.nook.com` or Vercel URL |
| `convex/` | Better Auth + data API | `*.convex.cloud` / `*.convex.site` |
| npm `nook` | Statement / wealth CLI | `bunx nook` / `npx nook` |

Auth and CLI browser login stay on **Spiky** until web graduates. Convex `SITE_URL` must be the Spiky origin, not web.

## Convex

From `convex/`:

```sh
bunx convex deploy
# or from repo root:
bun run deploy:convex
```

Set deployment env with `bunx convex env set` (not app `.env.local`):

| Variable | Purpose |
|----------|---------|
| `BETTER_AUTH_SECRET` | Random secret for Better Auth |
| `SITE_URL` | Spiky origin, e.g. `https://spiky.nook.com` |
| `TRUSTED_ORIGINS` | Optional CSV of extra origins (exact match; no wildcards) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (prefer a prod OAuth client) |

Google Cloud OAuth redirect URI:

`https://<deployment>.convex.site/api/auth/callback/google`

Current production deployment (team `s3q`, project `nook`):

- `CONVEX_URL=https://steady-wombat-304.convex.cloud`
- `CONVEX_SITE_URL=https://steady-wombat-304.convex.site`
- Google callback: `https://steady-wombat-304.convex.site/api/auth/callback/google`

Dev deployment remains `https://resilient-wren-480.convex.cloud` for local `convex dev`.

### Preview origins

Production Spiky is trusted via `SITE_URL`. Vercel preview URLs (`*.vercel.app`) are **not** trusted unless each origin is listed in `TRUSTED_ORIGINS`. Previews can still build; login may fail without that.

## Vercel

Two projects on the same monorepo. Each app has a `vercel.json` with Bun install, Turbo filter build, and SPA rewrite to `index.html`.

| Project | Root Directory | Build filter | Env |
|---------|----------------|--------------|-----|
| web | `apps/web` | `@nook/web` | none today |
| spiky | `apps/spiky` | `@nook/spiky` | see below |

Spiky production env (build-time, Vite-inlined):

- `VITE_CONVEX_URL` — prod `.cloud` URL
- `VITE_CONVEX_SITE_URL` — prod `.site` URL
- `VITE_SITE_URL` — same origin as Convex `SITE_URL` (e.g. `https://spiky.nook.com`)

Create projects (CLI or dashboard):

```sh
# from repo root, with Vercel CLI logged in
bunx vercel link --cwd apps/spiky   # create/link Spiky project
bunx vercel link --cwd apps/web     # create/link web project
bunx vercel env add VITE_CONVEX_URL --cwd apps/spiky
bunx vercel env add VITE_CONVEX_SITE_URL --cwd apps/spiky
bunx vercel env add VITE_SITE_URL --cwd apps/spiky
bunx vercel deploy --prod --cwd apps/spiky
bunx vercel deploy --prod --cwd apps/web
```

Custom domains (dashboard): attach `nook.com` / `www` → web; `spiky.nook.com` → Spiky. After Spiky’s custom domain is live, set Convex `SITE_URL` to match.

Keep Spiky unadvertised: no marketing links from web.

## CLI (`nook` on npm)

Publishable package name is **`nook`** (workspace package remains `@nook/cli`). One fat bundle — workspace `@nook/*` packages are not published separately.

```sh
# from repo root
bun run build:cli
bun run publish:cli   # dry-run first with --dry-run if needed
```

Usage:

```sh
bunx nook statement detect ./statement.pdf
bunx nook statement auth login
# or
npx nook statement auth login
```

Defaults:

- Production packaged CLI defaults Spiky to `https://spiky.nook.com`.
- Override with `NOOK_SPIKY_URL` or `--spiky-url` (local: `http://localhost:5174`).
- Optional `NOOK_SPIKY_ALLOWED_ORIGINS` for extra callback Origins.
- Session stored under `~/.config/nook/credentials.json`.

Local monorepo (no publish):

```sh
bun run statement auth login
NOOK_SPIKY_URL=http://localhost:5174 bun run statement auth login
```
