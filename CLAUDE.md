# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use 'bd' for task tracking

## Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # Run ESLint

# Database (Drizzle)
npx drizzle-kit generate   # Generate migrations from schema changes
npx drizzle-kit migrate    # Apply migrations
npx drizzle-kit studio     # Open database GUI
```

## Architecture

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM + PostgreSQL/Supabase, Tailwind CSS 4, shadcn/ui (radix-lyra), Hugeicons

**Key Paths**:

- `@/*` alias maps to project root
- Schema: `/lib/schema.ts`
- DB connection: `/lib/db.ts`
- Server actions: `/lib/actions/`
- UI components: `/components/ui/` (shadcn primitives)

**Routing**: File-based via App Router. Root (`/`) redirects to `/dashboard`.

## Database Schema

Core tables for personal finance tracking:

- **`accounts`** - Bank accounts/cards (credit_card, checking, savings, cash)
- **`categories`** - Expense categories with color/icon
- **`budgets`** - Monthly budget per category (unique on category+month)
- **`transactions`** - Purchase records (supports installments via entries)
- **`entries`** - Individual charges linked to transactions (tracks due date, paid status)

**Installment pattern**: Single `transaction` → multiple `entries` (one per month). Common for Brazilian credit card purchases.

## Conventions

**Money handling**:

- All monetary values stored as **cents** (integers)
- Use `centsToDisplay()` / `displayToCents()` from `/lib/utils.ts`
- Currency formatting for BRL (Brazilian Real)

**UI patterns**:

- Components use `class-variance-authority` (CVA) for variants
- `cn()` utility (clsx + tailwind-merge) for class merging
- Compound components (Card/CardHeader/CardContent)
- Icons via `@hugeicons/react`

**Date handling**:

- `getCurrentYearMonth()` returns "YYYY-MM" format
- `parseYearMonth()` / `addMonths()` for month arithmetic
