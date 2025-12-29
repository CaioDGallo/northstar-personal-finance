# 04 - Dashboard

Monthly budget overview with visual progress bars, total summary, and recent expenses.

---

## Overview

**Route:** `/dashboard` (home page, redirects from `/`)

**Features:**
- Month selector (navigate between months)
- Total spent vs total budget
- Per-category progress bars (color-coded)
- Recent 5 expenses
- Quick add button (FAB)

**Color coding:**
- Green: Under 80% of budget
- Yellow: 80-100% of budget
- Red: Over budget

---

## 1. Server Actions

### Create `/lib/actions/dashboard.ts`

```typescript
'use server';

import { db } from '@/lib/db';
import { entries, transactions, categories, budgets, accounts } from '@/lib/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export type DashboardData = {
  totalSpent: number; // cents
  totalBudget: number; // cents
  categoryBreakdown: {
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    spent: number;
    budget: number;
  }[];
  recentExpenses: {
    entryId: number;
    description: string;
    amount: number;
    dueDate: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  }[];
};

export async function getDashboardData(yearMonth: string): Promise<DashboardData> {
  // Parse year-month to get start/end dates
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endOfMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth}`;

  // 1. Get all budgets for the month
  const monthBudgets = await db
    .select({
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      budget: budgets.amount,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.yearMonth, yearMonth));

  // 2. Get spending by category for the month
  const spending = await db
    .select({
      categoryId: transactions.categoryId,
      spent: sql<number>`CAST(SUM(${entries.amount}) AS INTEGER)`,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(and(gte(entries.dueDate, startDate), lte(entries.dueDate, endDate)))
    .groupBy(transactions.categoryId);

  // 3. Merge budgets and spending
  const categoryBreakdown = monthBudgets.map((budget) => {
    const spentData = spending.find((s) => s.categoryId === budget.categoryId);
    return {
      categoryId: budget.categoryId,
      categoryName: budget.categoryName,
      categoryColor: budget.categoryColor,
      categoryIcon: budget.categoryIcon,
      spent: spentData?.spent || 0,
      budget: budget.budget,
    };
  });

  // 4. Calculate totals
  const totalBudget = categoryBreakdown.reduce((sum, cat) => sum + cat.budget, 0);
  const totalSpent = categoryBreakdown.reduce((sum, cat) => sum + cat.spent, 0);

  // 5. Get recent 5 expenses
  const recentExpenses = await db
    .select({
      entryId: entries.id,
      description: transactions.description,
      amount: entries.amount,
      dueDate: entries.dueDate,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(and(gte(entries.dueDate, startDate), lte(entries.dueDate, endDate)))
    .orderBy(sql`${entries.createdAt} DESC`)
    .limit(5);

  return {
    totalSpent,
    totalBudget,
    categoryBreakdown,
    recentExpenses,
  };
}
```

---

## 2. UI Components

### A. Budget Progress Bar (`/components/ui/budget-progress-bar.tsx`)

```tsx
import { formatCurrency } from '@/lib/utils';

type BudgetProgressBarProps = {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number; // cents
  budget: number; // cents
};

export function BudgetProgressBar({
  categoryName,
  categoryColor,
  categoryIcon,
  spent,
  budget,
}: BudgetProgressBarProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = percentage > 100;
  const isWarning = percentage >= 80 && percentage <= 100;
  const isGood = percentage < 80;

  const barColor = isOverBudget
    ? 'bg-red-500'
    : isWarning
    ? 'bg-yellow-500'
    : 'bg-green-500';

  const textColor = isOverBudget
    ? 'text-red-700'
    : isWarning
    ? 'text-yellow-700'
    : 'text-green-700';

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: categoryColor }}
          >
            {categoryIcon}
          </div>
          <span className="font-medium">{categoryName}</span>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${textColor}`}>
            {formatCurrency(spent)} / {formatCurrency(budget)}
          </div>
          <div className="text-xs text-gray-500">{percentage.toFixed(0)}%</div>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

### B. Summary Card (`/components/ui/summary-card.tsx`)

```tsx
import { formatCurrency } from '@/lib/utils';

type SummaryCardProps = {
  spent: number;
  budget: number;
};

export function SummaryCard({ spent, budget }: SummaryCardProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = budget - spent;
  const isOverBudget = remaining < 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-700">Monthly Summary</h2>

      <div className="space-y-4">
        <div>
          <div className="text-sm text-gray-500">Total Spent</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(spent)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Total Budget</div>
          <div className="text-2xl font-semibold text-gray-700">
            {formatCurrency(budget)}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-sm text-gray-500">
            {isOverBudget ? 'Over Budget' : 'Remaining'}
          </div>
          <div
            className={`text-2xl font-semibold ${
              isOverBudget ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {formatCurrency(Math.abs(remaining))}
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all ${
              isOverBudget ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="text-center text-sm text-gray-500">
          {percentage.toFixed(1)}% of budget used
        </div>
      </div>
    </div>
  );
}
```

### C. Recent Expenses List (`/components/recent-expenses.tsx`)

```tsx
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

type RecentExpensesProps = {
  expenses: {
    entryId: number;
    description: string;
    amount: number;
    dueDate: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  }[];
};

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Expenses</h2>
        <p className="text-center text-gray-500">No expenses this month yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Expenses</h2>
        <Link href="/expenses" className="text-sm text-blue-600 hover:underline">
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {expenses.map((expense) => (
          <div
            key={expense.entryId}
            className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: expense.categoryColor }}
              >
                {expense.categoryIcon}
              </div>
              <div>
                <div className="font-medium">{expense.description}</div>
                <div className="text-xs text-gray-500">
                  {expense.categoryName} • {expense.accountName}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatCurrency(expense.amount)}</div>
              <div className="text-xs text-gray-500">
                {new Date(expense.dueDate).toLocaleDateString('pt-BR', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 3. Dashboard Page

### Update `/app/dashboard/page.tsx`

```tsx
import { getDashboardData } from '@/lib/actions/dashboard';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/ui/month-picker';
import { SummaryCard } from '@/components/ui/summary-card';
import { BudgetProgressBar } from '@/components/ui/budget-progress-bar';
import { RecentExpenses } from '@/components/recent-expenses';
import { FAB } from '@/components/ui/fab';
import Link from 'next/link';

type PageProps = {
  searchParams: { month?: string };
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const yearMonth = searchParams.month || getCurrentYearMonth();
  const data = await getDashboardData(yearMonth);

  const hasNoBudgets = data.categoryBreakdown.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      {hasNoBudgets ? (
        <div className="rounded-lg border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">No budgets set for this month</h2>
          <p className="mb-6 text-gray-600">
            Set up your monthly budgets to start tracking your spending.
          </p>
          <Link
            href="/settings/budgets"
            className="inline-block rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            Set Budgets
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Summary */}
          <div className="space-y-6">
            <SummaryCard spent={data.totalSpent} budget={data.totalBudget} />
            <RecentExpenses expenses={data.recentExpenses} />
          </div>

          {/* Right column - Category breakdown */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Budget by Category</h2>
            <div className="space-y-4">
              {data.categoryBreakdown.map((category) => (
                <BudgetProgressBar
                  key={category.categoryId}
                  categoryName={category.categoryName}
                  categoryColor={category.categoryColor}
                  categoryIcon={category.categoryIcon}
                  spent={category.spent}
                  budget={category.budget}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <FAB />
    </div>
  );
}
```

---

## 4. Update Month Picker for Dashboard

The `MonthPicker` component created in settings works for dashboard too, but update it to support both routes:

### Update `/components/ui/month-picker.tsx`

```tsx
'use client';

import { addMonths } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';

type MonthPickerProps = {
  currentMonth: string;
};

export function MonthPicker({ currentMonth }: MonthPickerProps) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(direction: -1 | 1) {
    const newMonth = addMonths(currentMonth, direction);
    router.push(`${pathname}?month=${newMonth}`);
  }

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => navigate(-1)}
        className="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50"
        aria-label="Previous month"
      >
        ←
      </button>
      <span className="min-w-[180px] text-center text-lg font-medium capitalize">
        {monthName}
      </span>
      <button
        onClick={() => navigate(1)}
        className="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50"
        aria-label="Next month"
      >
        →
      </button>
    </div>
  );
}
```

---

## 5. Navigation Active State

### Update `/components/nav.tsx`

Add active state highlighting:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/expenses', label: 'Expenses' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 gap-8">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  isActive
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

---

## Testing

### Manual test flow:

1. **Set budgets first:**
   - Go to `/settings/budgets`
   - Set budgets for 2-3 categories for current month

2. **Add expenses:**
   - Add several expenses in those categories
   - Use current month dates

3. **View dashboard:**
   - Go to `/dashboard`
   - Should see summary card with totals
   - Should see progress bars (green if under 80%, yellow if 80-100%, red if over)
   - Should see recent 5 expenses

4. **Navigate months:**
   - Click arrows to go to previous/next month
   - No budgets → shows empty state
   - Go back to current month → data appears

5. **Check color coding:**
   - Add expenses to push a category over 80% → bar turns yellow
   - Add more to push over 100% → bar turns red

---

## Checkpoint ✓

You should now have:
- ✓ Dashboard with monthly overview
- ✓ Total spent vs budget summary card
- ✓ Per-category progress bars with color coding
- ✓ Recent 5 expenses list
- ✓ Month navigation
- ✓ Empty state when no budgets set
- ✓ Active navigation state

---

## 🎉 MVP Complete!

All core features are now implemented:

| Feature | Status |
|---------|--------|
| Accounts CRUD | ✓ |
| Categories CRUD | ✓ |
| Budgets (monthly) | ✓ |
| Add/Edit Expenses | ✓ |
| Installment support | ✓ |
| Expense list with filters | ✓ |
| Mark paid/pending | ✓ |
| Dashboard with progress bars | ✓ |
| Month navigation | ✓ |

---

## Next Steps (Post-MVP)

Once the MVP is working, consider adding:

1. **Auth** — Password protection or simple auth
2. **CSV Export** — Download expenses for backup
3. **Recurring expenses** — Auto-generate monthly charges
4. **Budget templates** — Copy budgets from previous months
5. **Charts** — Spending trends over time
6. **Dark mode** — Full dark theme support
7. **Mobile app** — PWA or React Native
8. **Multi-currency** — Support USD, EUR, etc.

---

## Deployment to Vercel

When ready to deploy:

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy → should work immediately

Vercel will automatically:
- Build Next.js app
- Connect to Turso
- Deploy to edge

**Cost:** Free on Vercel + Turso free tier (500 DBs, 9GB storage, 1B row reads/month).

---

Good luck with the build! 🚀
