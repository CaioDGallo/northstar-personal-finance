# Fluxo.sh (northstar)

Personal finance tracking app focused on clarity: track spending, income, credit card bills, and installments in the right month, with a mobile-first UI and a strong "you own your data" stance (imports/exports).

The product UI is primarily in pt-BR (see `messages/pt-BR.json`) with a secondary `messages/en.json`.

## What this app does

- Expenses, income, and transfers
- Credit card bills ("faturas") with closing/due dates
- Installments: one `transaction` -> many monthly `entries`
- Budgets by category (monthly)
- Imports (CSV/OFX) and exports (CSV)
- PWA experience (Serwist)

## Stack

- Next.js (App Router), React, TypeScript
- Drizzle ORM + Postgres (local Docker or Supabase)
- Tailwind CSS + shadcn/ui + Hugeicons
- Auth.js / NextAuth
- next-intl for i18n
- Vitest (unit) and Playwright (e2e)

## Local development

Prereqs:

- Node + pnpm (repo uses `pnpm`)
- Docker (recommended for local Postgres)

1) Install deps

```bash
pnpm install
```

2) Start Postgres (Docker)

```bash
docker compose -f compose.yml up -d
```

3) Configure env

```bash
cp .env.example .env
```

Minimum for local auth:

- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET=...` (generate with `openssl rand -base64 32`)
- Turnstile: you can use Cloudflare test keys from `.env.example`

4) Run migrations (local)

```bash
pnpm db:setup
```

5) Start the dev server

```bash
pnpm dev
```

Open http://localhost:3000

## Useful commands

```bash
pnpm lint
pnpm build
pnpm build:clean

pnpm test
pnpm test:run
pnpm test:coverage
pnpm test:e2e

pnpm db:migrate:local
pnpm db:seed
pnpm db:reset
```

## Database notes

- Money is stored as integer cents. Use `centsToDisplay()` / `displayToCents()` from `lib/utils.ts`.
- Installments follow the pattern: a single `transactions` row -> multiple `entries` rows (one per month).
- Schema lives in `lib/schema.ts`.
- Drizzle config: `drizzle.config.ts`.

## E2E testing notes (Playwright)

- Tests use Portuguese UI text selectors (not test IDs) to validate translations in production.
- Specs: `test/e2e/*.spec.ts`.

## Project workflow (issues)

This repo uses `bd` (beads) for issue tracking:

```bash
bd ready
bd show <id>
bd update <id> --status in_progress
bd close <id>
bd sync
```

## Contributing

- Keep user-facing strings in `next-intl` messages (pt-BR is primary).
- Prefer accessible selectors and Portuguese text in e2e tests.
- Avoid changing money units: always store cents.
