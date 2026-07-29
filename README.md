# Nook

Human-First Financial Operating System monorepo.

## Phase 0 Status

Phase 0 (scaffold) is implemented with:
- Convex workspace at `convex/` with schema stub.
- Vite + React web app at `apps/web`.
- Expo Router mobile app at `apps/mobile`.
- Domain package stubs at `packages/domain`.
- Turbo root tasks and workspace wiring.

## Workspaces

- `apps/web` - Vite + React app (`@nook/web`)
- `apps/spiky` - Vite + React playground for spikes and POCs (`@nook/spiky`)
- `apps/mobile` - Expo app (`@nook/mobile`)
- `convex` - Convex backend workspace (`@nook/convex`)
- `packages/domain` - Shared domain types and helpers (`@nook/domain`)

## Commands

From repository root:

```sh
bun install
bun run typecheck
```

Run individual dev services:

```sh
bun run dev:web
bun run dev:spiky
bun run dev:mobile
bun run dev:convex
```

Run all dev tasks through turbo:

```sh
bun run dev
```
