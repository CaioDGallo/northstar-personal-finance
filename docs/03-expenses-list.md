# 03 - Expenses List

View all expenses, filter by date/category/account/status, mark as paid, and delete.

---

## Overview

**Route:** `/expenses`

**Features:**
- List all entries (not transactions, since each installment is separate)
- Group by date (newest first)
- Show installment indicator (e.g., "2/10")
- Filter by: date range, category, account, status (pending/paid)
- Quick actions: mark paid/unpaid, delete transaction

**Note:** Display entries (the actual monthly charges), not transactions. Users care about what hits their budget each month.

---

## 1. Server Actions

### Update `/lib/actions/expenses.ts`

Add these functions:

```typescript
export type ExpenseFilters = {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  accountId?: number;
  status?: 'pending' | 'paid' | 'all';
};

export async function getExpenses(filters: ExpenseFilters = {}) {
  const { startDate, endDate, categoryId, accountId, status = 'all' } = filters;

  // Build query
  let query = db
    .select({
      entryId: entries.id,
      amount: entries.amount,
      dueDate: entries.dueDate,
      paidAt: entries.paidAt,
      installmentNumber: entries.installmentNumber,
      transactionId: transactions.id,
      description: transactions.description,
      totalInstallments: transactions.totalInstallments,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountId: accounts.id,
      accountName: accounts.name,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id));

  // Apply filters
  const conditions = [];

  if (startDate) {
    conditions.push(gte(entries.dueDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(entries.dueDate, endDate));
  }
  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId));
  }
  if (accountId) {
    conditions.push(eq(entries.accountId, accountId));
  }
  if (status === 'pending') {
    conditions.push(isNull(entries.paidAt));
  }
  if (status === 'paid') {
    conditions.push(isNotNull(entries.paidAt));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query.orderBy(desc(entries.dueDate));

  return results;
}

export async function markEntryPaid(entryId: number) {
  await db
    .update(entries)
    .set({ paidAt: new Date().toISOString() })
    .where(eq(entries.id, entryId));

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function markEntryPending(entryId: number) {
  await db
    .update(entries)
    .set({ paidAt: null })
    .where(eq(entries.id, entryId));

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}
```

**Note:** Add these imports at the top of `expenses.ts`:

```typescript
import { gte, lte, isNull, isNotNull, desc, and } from 'drizzle-orm';
import { accounts, categories } from '@/lib/schema';
```

---

## 2. UI Components

### A. Status Badge (`/components/ui/status-badge.tsx`)

```tsx
type StatusBadgeProps = {
  paidAt: string | null;
};

export function StatusBadge({ paidAt }: StatusBadgeProps) {
  if (paidAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Paid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
      Pending
    </span>
  );
}
```

### B. Installment Badge (`/components/ui/installment-badge.tsx`)

```tsx
type InstallmentBadgeProps = {
  current: number;
  total: number;
};

export function InstallmentBadge({ current, total }: InstallmentBadgeProps) {
  if (total === 1) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
      {current}/{total}
    </span>
  );
}
```

### C. Expense Card (`/components/expense-card.tsx`)

```tsx
import { formatCurrency } from '@/lib/utils';
import { StatusBadge } from './ui/status-badge';
import { InstallmentBadge } from './ui/installment-badge';
import { markEntryPaid, markEntryPending, deleteExpense } from '@/lib/actions/expenses';
import Link from 'next/link';

type ExpenseCardProps = {
  entry: {
    entryId: number;
    amount: number;
    dueDate: string;
    paidAt: string | null;
    installmentNumber: number;
    transactionId: number;
    description: string;
    totalInstallments: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  };
};

export function ExpenseCard({ entry }: ExpenseCardProps) {
  const isPaid = !!entry.paidAt;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-gray-300">
      <div className="flex items-center gap-4">
        {/* Category icon */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: entry.categoryColor }}
        >
          {entry.categoryIcon}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{entry.description}</h3>
            <InstallmentBadge
              current={entry.installmentNumber}
              total={entry.totalInstallments}
            />
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span>{entry.categoryName}</span>
            <span>•</span>
            <span>{entry.accountName}</span>
            <span>•</span>
            <span>{new Date(entry.dueDate).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-lg font-semibold">{formatCurrency(entry.amount)}</div>
          <StatusBadge paidAt={entry.paidAt} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isPaid ? (
            <form action={markEntryPending.bind(null, entry.entryId)}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                title="Mark as pending"
              >
                Undo
              </button>
            </form>
          ) : (
            <form action={markEntryPaid.bind(null, entry.entryId)}>
              <button
                type="submit"
                className="rounded-md border border-green-300 px-3 py-1 text-sm text-green-600 hover:bg-green-50"
                title="Mark as paid"
              >
                Pay
              </button>
            </form>
          )}

          <Link
            href={`/expenses/${entry.transactionId}`}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Edit
          </Link>

          <form action={deleteExpense.bind(null, entry.transactionId)}>
            <button
              type="submit"
              className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              title="Delete entire transaction"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### D. Filter Panel (`/components/filter-panel.tsx`)

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Account, Category } from '@/lib/schema';

type FilterPanelProps = {
  accounts: Account[];
  categories: Category[];
};

export function FilterPanel({ accounts, categories }: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
  const [accountId, setAccountId] = useState(searchParams.get('accountId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');

  function applyFilters() {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (categoryId) params.set('categoryId', categoryId);
    if (accountId) params.set('accountId', accountId);
    if (status !== 'all') params.set('status', status);

    router.push(`/expenses?${params.toString()}`);
  }

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setCategoryId('');
    setAccountId('');
    setStatus('all');
    router.push('/expenses');
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        {isOpen ? 'Hide Filters' : 'Show Filters'}
      </button>

      {isOpen && (
        <div className="mt-4 grid gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="account" className="block text-sm font-medium text-gray-700">
              Account
            </label>
            <select
              id="account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Expenses List Page

### Update `/app/expenses/page.tsx`

```tsx
import { getExpenses, type ExpenseFilters } from '@/lib/actions/expenses';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { ExpenseCard } from '@/components/expense-card';
import { FilterPanel } from '@/components/filter-panel';
import { FAB } from '@/components/ui/fab';
import Link from 'next/link';

type PageProps = {
  searchParams: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    accountId?: string;
    status?: 'pending' | 'paid' | 'all';
  };
};

export default async function ExpensesPage({ searchParams }: PageProps) {
  const filters: ExpenseFilters = {
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    categoryId: searchParams.categoryId ? parseInt(searchParams.categoryId) : undefined,
    accountId: searchParams.accountId ? parseInt(searchParams.accountId) : undefined,
    status: searchParams.status || 'all',
  };

  const [expenses, accounts, categories] = await Promise.all([
    getExpenses(filters),
    getAccounts(),
    getCategories(),
  ]);

  // Group by date
  const groupedByDate = expenses.reduce((acc, expense) => {
    const date = expense.dueDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(expense);
    return acc;
  }, {} as Record<string, typeof expenses>);

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Link
          href="/expenses/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Expense
        </Link>
      </div>

      <FilterPanel accounts={accounts} categories={categories} />

      {expenses.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">No expenses found.</p>
          <Link
            href="/expenses/new"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Add your first expense
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="mb-3 text-sm font-medium text-gray-500">
                {new Date(date).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>
              <div className="space-y-3">
                {groupedByDate[date].map((expense) => (
                  <ExpenseCard key={expense.entryId} entry={expense} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <FAB />
    </div>
  );
}
```

---

## Testing

### Manual test flow:

1. **View expenses:**
   - Go to `/expenses`
   - Should see grouped by date, newest first

2. **Mark as paid:**
   - Click "Pay" on a pending expense
   - Badge should change to green "Paid"

3. **Filter:**
   - Click "Show Filters"
   - Select category → only those expenses show
   - Select status "Pending" → only unpaid show

4. **Edit:**
   - Click "Edit" on an expense
   - Modify and save
   - Redirects back to list

5. **Delete:**
   - Click "Delete" on an installment expense
   - All entries for that transaction should be deleted

---

## Checkpoint ✓

You should now have:
- ✓ Expense list view (grouped by date)
- ✓ Filter panel (date, category, account, status)
- ✓ Mark paid/pending actions
- ✓ Edit and delete actions
- ✓ Installment badges showing "2/10"
- ✓ Floating action button for quick add

**Next:** Move to `04-dashboard.md` to build the monthly overview with budget progress bars.
