# 00 - Project Setup (DONE)

Initialize Next.js 16 project with Turso database, Drizzle ORM, and, Shadcn/ui Tailwind CSS v4.

---

## 1. Create Next.js Project

```bash
npx create-next-app@latest northstar-finance
# Select:
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: No
# ✓ App Router: Yes
# ✓ Customize default import alias: No

cd northstar-finance
```

---

## 2. Install Dependencies

```bash
npm install @libsql/client drizzle-orm
npm install -D drizzle-kit
```

**Packages:**

- `@libsql/client` — Turso SQLite client
- `drizzle-orm` — TypeScript ORM
- `drizzle-kit` — Migration and schema tools

---

## 3. Configure Turso

### A. Install Turso CLI (if not already installed)

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Verify installation
turso --version
```

### B. Create Database

```bash
# Login (first time only)
turso auth login

# Create production database
turso db create northstar-finance

# Get database URL
turso db show northstar-finance --url

# Create auth token
turso db tokens create northstar-finance
```

### C. Create `.env.local`

```env
# Production (Turso)
TURSO_DATABASE_URL=libsql://[your-db-name]-[your-org].turso.io
TURSO_AUTH_TOKEN=eyJhbGc...your-token-here

# Local development (optional, uses file-based SQLite)
# Comment out TURSO_* vars above and use this instead:
# DATABASE_URL=file:./local.db
```

**Note:** For local dev, you can use `file:./local.db` instead of Turso. Swap env vars when deploying.

---

## 4. Set Up Drizzle Schema

### A. Create `/lib/schema.ts`

```typescript
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// Accounts table
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['credit_card', 'checking', 'savings', 'cash'] }).notNull(),
  currency: text('currency').default('BRL'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Categories table
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  icon: text('icon'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Budgets table
export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // '2024-01'
    amount: integer('amount').notNull(), // cents
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqueCategoryMonth: unique().on(table.categoryId, table.yearMonth),
  })
);

// Transactions table (parent for installments)
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  totalAmount: integer('total_amount').notNull(), // cents
  totalInstallments: integer('total_installments').notNull().default(1),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Entries table (actual monthly charges)
export const entries = sqliteTable('entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  amount: integer('amount').notNull(), // cents
  dueDate: text('due_date').notNull(), // 'YYYY-MM-DD'
  paidAt: text('paid_at'), // null = pending, date = paid
  installmentNumber: integer('installment_number').notNull().default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Type exports for TypeScript
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
```

### B. Create `/lib/db.ts`

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Create Turso client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create Drizzle instance
export const db = drizzle(client, { schema });
```

### C. Create `drizzle.config.ts` (root directory)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/schema.ts',
  out: './drizzle',
  driver: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  },
} satisfies Config;
```

---

## 5. Run Migrations

### A. Generate Migration

```bash
npx drizzle-kit generate:sqlite
```

This creates migration files in `/drizzle`.

### B. Push to Database

```bash
npx drizzle-kit push:sqlite
```

Applies schema to your Turso database.

### C. Verify

```bash
turso db shell northstar-finance

# In shell, run:
.tables
# Should see: accounts, budgets, categories, entries, transactions

.schema accounts
# Should see the full table definition

.exit
```

---

## 6. Create Folder Structure

```bash
mkdir -p app/dashboard
mkdir -p app/expenses/new
mkdir -p app/expenses/[id]
mkdir -p app/settings/accounts
mkdir -p app/settings/categories
mkdir -p app/settings/budgets
mkdir -p components/ui
mkdir -p lib/actions
```

**Structure:**

```
/app
  /dashboard          → Main overview screen
  /expenses           → List expenses
    /new              → Add expense
    /[id]             → Edit expense
  /settings           → Settings hub
    /accounts         → Manage accounts
    /categories       → Manage categories
    /budgets          → Set monthly budgets
/components
  /ui                 → Reusable UI components
/lib
  /db.ts              → Database client
  /schema.ts          → Drizzle schema
  /actions            → Server actions
```

---

## 7. Configure Tailwind CSS v4

### A. Update `app/globals.css`

Replace contents with:

```css
@import "tailwindcss";

@theme {
  /* Custom colors for finance app */
  --color-success: oklch(0.65 0.15 145);
  --color-warning: oklch(0.75 0.15 85);
  --color-danger: oklch(0.60 0.20 25);
  --color-info: oklch(0.60 0.15 240);
}

/* Base styles */
body {
  @apply bg-gray-50 text-gray-900;
}

/* Dark mode support (optional for later) */
@media (prefers-color-scheme: dark) {
  body {
    @apply bg-gray-900 text-gray-100;
  }
}
```

### B. Remove default Tailwind config

Tailwind v4 uses CSS-first config. Delete `tailwind.config.js` and `tailwind.config.ts` if they exist.

---

## 8. Create Basic Layout with Navigation

### A. Create `/components/nav.tsx`

```tsx
import Link from 'next/link';

export function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex gap-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-900 hover:border-gray-300"
            >
              Dashboard
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              Expenses
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

### B. Update `/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/nav';

export const metadata: Metadata = {
  title: 'Northstar Finance',
  description: 'Personal finance tracking with installment support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
```

### C. Update `/app/page.tsx` (redirect to dashboard)

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

---

## 9. Create Placeholder Pages

### A. `/app/dashboard/page.tsx`

```tsx
export default function DashboardPage() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
```

### B. `/app/expenses/page.tsx`

```tsx
export default function ExpensesPage() {
  return <h1 className="text-2xl font-bold">Expenses</h1>;
}
```

### C. `/app/settings/page.tsx`

```tsx
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid gap-4">
        <Link
          href="/settings/accounts"
          className="block rounded-lg border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">Accounts</h2>
          <p className="text-sm text-gray-600">Manage bank accounts and credit cards</p>
        </Link>
        <Link
          href="/settings/categories"
          className="block rounded-lg border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">Categories</h2>
          <p className="text-sm text-gray-600">Manage expense categories</p>
        </Link>
        <Link
          href="/settings/budgets"
          className="block rounded-lg border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">Budgets</h2>
          <p className="text-sm text-gray-600">Set monthly budgets per category</p>
        </Link>
      </div>
    </div>
  );
}
```

---

## 10. Test the Setup

```bash
npm run dev
```

Visit `http://localhost:3000`:

- Should redirect to `/dashboard`
- Navigation should work (Dashboard, Expenses, Settings)
- Settings page should show 3 links

---

## 11. Helper Utilities

### Create `/lib/utils.ts`

```typescript
/**
 * Convert cents to currency string
 * @example centsToDisplay(10050) → "100.50"
 */
export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Convert currency string to cents
 * @example displayToCents("100.50") → 10050
 */
export function displayToCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

/**
 * Format cents as Brazilian Real
 * @example formatCurrency(10050) → "R$ 100,50"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Get current year-month string
 * @example getCurrentYearMonth() → "2024-01"
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse year-month string to Date
 * @example parseYearMonth("2024-01") → Date(2024, 0, 1)
 */
export function parseYearMonth(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Add months to year-month string
 * @example addMonths("2024-01", 1) → "2024-02"
 */
export function addMonths(yearMonth: string, months: number): string {
  const date = parseYearMonth(yearMonth);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
```

---

## Checkpoint ✓

You should now have:

- ✓ Next.js 16 project with App Router
- ✓ Turso database connected
- ✓ Drizzle ORM configured with full schema
- ✓ Tailwind CSS v4 configured
- ✓ Navigation working
- ✓ Folder structure ready
- ✓ Helper utilities for currency conversion

**Next:** Move to `01-settings.md` to build account/category/budget management.
