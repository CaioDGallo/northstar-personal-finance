# 01 - Settings (Accounts, Categories, Budgets)

Build CRUD interfaces for accounts, categories, and budgets. These are foundation data needed before adding expenses.

---

## Overview

**Routes:**

- `/settings` — Hub with links (already created in setup)
- `/settings/accounts` — Manage accounts
- `/settings/categories` — Manage categories
- `/settings/budgets` — Set monthly budgets

**Order:** Build accounts first, then categories, then budgets (budgets depend on categories).

---

## 1. Accounts Management

### A. Server Actions (`/lib/actions/accounts.ts`)

```typescript
'use server';

import { db } from '@/lib/db';
import { accounts, type NewAccount } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getAccounts() {
  return await db.select().from(accounts).orderBy(accounts.name);
}

export async function createAccount(data: Omit<NewAccount, 'id' | 'createdAt'>) {
  await db.insert(accounts).values(data);
  revalidatePath('/settings/accounts');
}

export async function updateAccount(id: number, data: Partial<NewAccount>) {
  await db.update(accounts).set(data).where(eq(accounts.id, id));
  revalidatePath('/settings/accounts');
}

export async function deleteAccount(id: number) {
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath('/settings/accounts');
}
```

### B. Account Form Component (`/components/account-form.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { createAccount, updateAccount } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';

type AccountFormProps = {
  account?: Account;
  onClose: () => void;
};

export function AccountForm({ account, onClose }: AccountFormProps) {
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<'credit_card' | 'checking' | 'savings' | 'cash'>(
    account?.type || 'checking'
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (account) {
      await updateAccount(account.id, { name, type });
    } else {
      await createAccount({ name, type });
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="NuBank CC"
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit_card">Credit Card</option>
          <option value="cash">Cash</option>
        </select>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {account ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
```

### C. Accounts Page (`/app/settings/accounts/page.tsx`)

```tsx
import { getAccounts, deleteAccount } from '@/lib/actions/accounts';
import { AccountForm } from '@/components/account-form';
import { Modal } from '@/components/ui/modal';

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Modal
          trigger={
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Add Account
            </button>
          }
        >
          {(close) => <AccountForm onClose={close} />}
        </Modal>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
          >
            <div>
              <h3 className="font-medium">{account.name}</h3>
              <p className="text-sm text-gray-500 capitalize">
                {account.type.replace('_', ' ')}
              </p>
            </div>
            <div className="flex gap-2">
              <Modal
                trigger={
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                    Edit
                  </button>
                }
              >
                {(close) => <AccountForm account={account} onClose={close} />}
              </Modal>
              <form action={deleteAccount.bind(null, account.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### D. Modal Component (`/components/ui/modal.tsx`)

```tsx
'use client';

import { useState } from 'react';

type ModalProps = {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
};

export function Modal({ trigger, children }: ModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div onClick={() => setIsOpen(true)}>{trigger}</div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            {children(() => setIsOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}
```

---

## 2. Categories Management

### A. Server Actions (`/lib/actions/categories.ts`)

```typescript
'use server';

import { db } from '@/lib/db';
import { categories, type NewCategory } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getCategories() {
  return await db.select().from(categories).orderBy(categories.name);
}

export async function createCategory(data: Omit<NewCategory, 'id' | 'createdAt'>) {
  await db.insert(categories).values(data);
  revalidatePath('/settings/categories');
}

export async function updateCategory(id: number, data: Partial<NewCategory>) {
  await db.update(categories).set(data).where(eq(categories.id, id));
  revalidatePath('/settings/categories');
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath('/settings/categories');
}
```

### B. Category Form Component (`/components/category-form.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { createCategory, updateCategory } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

const ICONS = []; //Use icons from the project icons lib

type CategoryFormProps = {
  category?: Category;
  onClose: () => void;
};

export function CategoryForm({ category, onClose }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);
  const [icon, setIcon] = useState(category?.icon || ICONS[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (category) {
      await updateCategory(category.id, { name, color, icon });
    } else {
      await createCategory({ name, color, icon });
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Food & Dining"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
        <div className="grid grid-cols-8 gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
        <div className="grid grid-cols-5 gap-2">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={`text-2xl p-2 rounded-md ${icon === i ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {category ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
```

### C. Categories Page (`/app/settings/categories/page.tsx`)

```tsx
import { getCategories, deleteCategory } from '@/lib/actions/categories';
import { CategoryForm } from '@/components/category-form';
import { Modal } from '@/components/ui/modal';

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Modal
          trigger={
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Add Category
            </button>
          }
        >
          {(close) => <CategoryForm onClose={close} />}
        </Modal>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: category.color }}
              >
                {category.icon}
              </div>
              <h3 className="font-medium">{category.name}</h3>
            </div>
            <div className="flex gap-2">
              <Modal
                trigger={
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                    Edit
                  </button>
                }
              >
                {(close) => <CategoryForm category={category} onClose={close} />}
              </Modal>
              <form action={deleteCategory.bind(null, category.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 3. Budgets Management

### A. Server Actions (`/lib/actions/budgets.ts`)

```typescript
'use server';

import { db } from '@/lib/db';
import { budgets, categories } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getBudgetsForMonth(yearMonth: string) {
  // Get all categories with their budgets for the month
  const result = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      budgetId: budgets.id,
      budgetAmount: budgets.amount,
    })
    .from(categories)
    .leftJoin(
      budgets,
      and(eq(budgets.categoryId, categories.id), eq(budgets.yearMonth, yearMonth))
    )
    .orderBy(categories.name);

  return result;
}

export async function upsertBudget(
  categoryId: number,
  yearMonth: string,
  amount: number
) {
  // Try to update existing budget
  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.categoryId, categoryId), eq(budgets.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length > 0) {
    // Update
    await db
      .update(budgets)
      .set({ amount })
      .where(eq(budgets.id, existing[0].id));
  } else {
    // Insert
    await db.insert(budgets).values({ categoryId, yearMonth, amount });
  }

  revalidatePath('/settings/budgets');
}
```

### B. Budget Form Component (`/components/budget-form.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { upsertBudget } from '@/lib/actions/budgets';
import { displayToCents, centsToDisplay } from '@/lib/utils';

type BudgetRow = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  budgetAmount: number | null;
};

type BudgetFormProps = {
  yearMonth: string;
  budgets: BudgetRow[];
};

export function BudgetForm({ yearMonth, budgets }: BudgetFormProps) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(
      budgets.map((b) => [
        b.categoryId,
        b.budgetAmount ? centsToDisplay(b.budgetAmount) : '',
      ])
    )
  );

  async function handleChange(categoryId: number, value: string) {
    setValues((prev) => ({ ...prev, [categoryId]: value }));

    // Auto-save on blur (debounce could be added here)
    if (value && !isNaN(parseFloat(value))) {
      const cents = displayToCents(value);
      await upsertBudget(categoryId, yearMonth, cents);
    }
  }

  return (
    <div className="space-y-3">
      {budgets.map((budget) => (
        <div
          key={budget.categoryId}
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
              style={{ backgroundColor: budget.categoryColor }}
            >
              {budget.categoryIcon}
            </div>
            <span className="font-medium">{budget.categoryName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">R$</span>
            <input
              type="number"
              step="0.01"
              value={values[budget.categoryId] || ''}
              onChange={(e) => handleChange(budget.categoryId, e.target.value)}
              placeholder="0.00"
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### C. Month Picker Component (`/components/ui/month-picker.tsx`)

```tsx
'use client';

import { addMonths } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type MonthPickerProps = {
  currentMonth: string;
};

export function MonthPicker({ currentMonth }: MonthPickerProps) {
  const router = useRouter();

  function navigate(direction: -1 | 1) {
    const newMonth = addMonths(currentMonth, direction);
    router.push(`/settings/budgets?month=${newMonth}`);
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
      >
        ←
      </button>
      <span className="text-lg font-medium capitalize">{monthName}</span>
      <button
        onClick={() => navigate(1)}
        className="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50"
      >
        →
      </button>
    </div>
  );
}
```

### D. Budgets Page (`/app/settings/budgets/page.tsx`)

```tsx
import { getBudgetsForMonth } from '@/lib/actions/budgets';
import { BudgetForm } from '@/components/budget-form';
import { MonthPicker } from '@/components/ui/month-picker';
import { getCurrentYearMonth } from '@/lib/utils';

type PageProps = {
  searchParams: { month?: string };
};

export default async function BudgetsPage({ searchParams }: PageProps) {
  const yearMonth = searchParams.month || getCurrentYearMonth();
  const budgets = await getBudgetsForMonth(yearMonth);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      <BudgetForm yearMonth={yearMonth} budgets={budgets} />
    </div>
  );
}
```

---

## Checkpoint ✓

You should now have:

- ✓ Account CRUD (create, list, edit, delete)
- ✓ Category CRUD with color and icon pickers
- ✓ Budget management per month per category
- ✓ Modal component for forms
- ✓ Month navigation

**Next:** Move to `02-add-expense.md` to build the expense entry form with installment support.
