# syntax=docker/dockerfile:1

FROM oven/bun:1.3.9 AS base
WORKDIR /app

# Install workspace deps from lockfile
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/mcp/package.json apps/mcp/
COPY packages/contracts/package.json packages/contracts/
COPY packages/shared/package.json packages/shared/
COPY packages/readers/package.json packages/readers/
COPY packages/detectors/package.json packages/detectors/
COPY packages/parsers/package.json packages/parsers/
COPY packages/normalizers/package.json packages/normalizers/
COPY packages/validators/package.json packages/validators/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/persistence/package.json packages/persistence/
COPY packages/domain/package.json packages/domain/
COPY convex/package.json convex/

RUN bun install --frozen-lockfile

COPY apps/mcp apps/mcp
COPY packages packages
COPY convex convex

WORKDIR /app/apps/mcp
ENV PORT=8787
EXPOSE 8787

CMD ["bun", "run", "src/index.ts"]
