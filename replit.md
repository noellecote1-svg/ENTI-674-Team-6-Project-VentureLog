# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

### `artifacts/venturelog` (`@workspace/venturelog`)

React + Vite frontend for VentureLog. Served at the root path (`/`).

- Pages: Home dashboard (`/`), Journal list (`/journal`), Journal editor (`/journal/new`, `/journal/:id/edit`), Metrics (`/metrics`, `/metrics/:id`), Decision Log (`/decisions`, `/decisions/:id`), AI Coach placeholder, Investor Update placeholder
- Stack: React 18, Vite, Tailwind CSS, shadcn/ui, Recharts, @uiw/react-md-editor, wouter routing, @tanstack/react-query
- Fonts: Inter (UI text) + JetBrains Mono (metric values) from Google Fonts
- Design system: Navy #1F4E79, Action Blue #2E75B6, Canvas BG #F8FAFC, 8px card radius, 999px badge radius
- API hooks from `@workspace/api-client-react`; types imported from top-level `@workspace/api-client-react` (not deep path)

## VentureLog Product

### Phase Status
- **Phase 1 (Journal + Dashboard)**: COMPLETE — journal CRUD with markdown editor, tag filtering, auto-save, localStorage draft recovery, "promote to decision log" toggle
- **Phase 2 (Metrics)**: COMPLETE — 8-metric limit, metric values with sparklines/recharts, percent change indicators
- **Phase 3 (AI Coach)**: Placeholder page; backend route stubs ready; requires OPENAI_API_KEY
- **Phase 4 (Decision Log)**: COMPLETE — full CRUD, archive/close flows, comment threads
- **Phase 5 (Investor Update)**: Placeholder page
- **Phase 6 (Auth/Billing)**: NOT STARTED — do not begin until explicitly asked

### Key Business Rules
- Max 8 active metrics per user (enforced in API)
- 7 fixed journal tags: Product, Growth, Team, Fundraising, Operations, Finance, Reflection
- Decisions have status (open/closed) + archive flag
- No emojis anywhere in the UI
- No auth yet — all data is global/single-user in Phase 1

### Notable Implementation Details
- Decimal values from Drizzle come as strings — parse with `parseFloat()` in route handlers
- Import `zod` (not `zod/v4`) in api-server route files (esbuild bundling constraint)
- Import types from `@workspace/api-client-react` (top-level), NOT from `@workspace/api-client-react/src/generated/api.schemas`
- Dashboard summary endpoint computes sparkline data, percent change, and daily prompts (stale metric, open decision, or default)
