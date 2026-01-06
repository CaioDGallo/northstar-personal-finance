# Agent Instructions

Use 'bd' for task tracking

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**

- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

For full workflow details: `bd prime`

If you find work that must be done while doing a task, file beads issues for it. For example finding a bug in the middle of other task, a critical improvement, broken tests, any kind of work that is worth doing.

While doing a code review, keep track of it and note your findings in a dedicated beads issue, so it can be later analyzed and worked on.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds (linters can fail for pre-existing issues, but builds must always succeed)
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   pnpm lint # MUST NOT have errors from the current task, and the issues that might arrise corrected in the best possible way
   pnpm build | pnpm build:clean # MUST succeed, and the issues that might arrise corrected in the best possible way
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

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
