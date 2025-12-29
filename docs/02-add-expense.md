# 02 - Add/Edit Expense

Build expense entry form with installment (parcelamento) support. Creates transaction + generates monthly entries.

---

## Overview

**Routes:**
- `/expenses/new` — Add new expense
- `/expenses/[id]` — Edit existing expense (same form, prefilled)

**Flow:**
1. User enters total amount, category, account, date, installments
2. System creates 1 transaction record
3. System generates N entry records (one per installment)
4. Each entry has sequential due dates (monthly)

**Example:** R$1000 in 10x → 1 transaction + 10 entries of R$100 each, due on the 15th of each month for 10 months.

---

## 1. Server Actions

### Create `/lib/actions/expenses.ts`

```typescript
'use server';

import { db } from '@/lib/db';
import { transactions, entries, type NewTransaction, type NewEntry } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type CreateExpenseData = {
  description: string;
  totalAmount: number; // cents
  categoryId: number;
  accountId: number;
  dueDate: string; // 'YYYY-MM-DD' for first installment
  installments: number;
};

export async function createExpense(data: CreateExpenseData) {
  // 1. Create transaction
  const [transaction] = await db
    .insert(transactions)
    .values({
      description: data.description,
      totalAmount: data.totalAmount,
      totalInstallments: data.installments,
      categoryId: data.categoryId,
    })
    .returning();

  // 2. Generate entries for each installment
  const amountPerInstallment = Math.round(data.totalAmount / data.installments);
  const baseDate = new Date(data.dueDate);

  const entriesToInsert: NewEntry[] = [];

  for (let i = 0; i < data.installments; i++) {
    const installmentDate = new Date(baseDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    // Adjust for last installment (rounding differences)
    const amount =
      i === data.installments - 1
        ? data.totalAmount - amountPerInstallment * (data.installments - 1)
        : amountPerInstallment;

    entriesToInsert.push({
      transactionId: transaction.id,
      accountId: data.accountId,
      amount,
      dueDate: installmentDate.toISOString().split('T')[0],
      installmentNumber: i + 1,
      paidAt: null,
    });
  }

  await db.insert(entries).values(entriesToInsert);

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function getTransactionWithEntries(transactionId: number) {
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    with: {
      entries: true,
    },
  });
  return transaction;
}

export async function updateExpense(transactionId: number, data: CreateExpenseData) {
  // 1. Update transaction
  await db
    .update(transactions)
    .set({
      description: data.description,
      totalAmount: data.totalAmount,
      totalInstallments: data.installments,
      categoryId: data.categoryId,
    })
    .where(eq(transactions.id, transactionId));

  // 2. Delete old entries
  await db.delete(entries).where(eq(entries.transactionId, transactionId));

  // 3. Regenerate entries (same logic as create)
  const amountPerInstallment = Math.round(data.totalAmount / data.installments);
  const baseDate = new Date(data.dueDate);

  const entriesToInsert: NewEntry[] = [];

  for (let i = 0; i < data.installments; i++) {
    const installmentDate = new Date(baseDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    const amount =
      i === data.installments - 1
        ? data.totalAmount - amountPerInstallment * (data.installments - 1)
        : amountPerInstallment;

    entriesToInsert.push({
      transactionId,
      accountId: data.accountId,
      amount,
      dueDate: installmentDate.toISOString().split('T')[0],
      installmentNumber: i + 1,
      paidAt: null,
    });
  }

  await db.insert(entries).values(entriesToInsert);

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function deleteExpense(transactionId: number) {
  // CASCADE will delete entries automatically
  await db.delete(transactions).where(eq(transactions.id, transactionId));
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}
```

**Note:** Add relations to schema for `with` queries.

### Update `/lib/schema.ts` (add relations)

Add this at the bottom of `/lib/schema.ts`:

```typescript
import { relations } from 'drizzle-orm';

export const transactionsRelations = relations(transactions, ({ many }) => ({
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [entries.transactionId],
    references: [transactions.id],
  }),
  account: one(accounts, {
    fields: [entries.accountId],
    references: [accounts.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));
```

---

## 2. Expense Form Component

### Create `/components/expense-form.tsx`

```tsx
'use client';

import { useState } from 'react';
import { createExpense, updateExpense } from '@/lib/actions/expenses';
import { displayToCents, centsToDisplay } from '@/lib/utils';
import type { Account, Category, Transaction } from '@/lib/schema';
import { useRouter } from 'next/navigation';

type ExpenseFormProps = {
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction & { entries: any[] }; // For editing
};

export function ExpenseForm({ accounts, categories, transaction }: ExpenseFormProps) {
  const router = useRouter();

  // Form state
  const [amount, setAmount] = useState(
    transaction ? centsToDisplay(transaction.totalAmount) : ''
  );
  const [description, setDescription] = useState(transaction?.description || '');
  const [categoryId, setCategoryId] = useState<number>(
    transaction?.categoryId || categories[0]?.id || 0
  );
  const [accountId, setAccountId] = useState<number>(
    transaction?.entries[0]?.accountId || accounts[0]?.id || 0
  );
  const [dueDate, setDueDate] = useState(
    transaction?.entries[0]?.dueDate || new Date().toISOString().split('T')[0]
  );
  const [installments, setInstallments] = useState(
    transaction?.totalInstallments || 1
  );

  const totalCents = amount ? displayToCents(amount) : 0;
  const perInstallment = installments > 0 ? totalCents / installments : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      description,
      totalAmount: totalCents,
      categoryId,
      accountId,
      dueDate,
      installments,
    };

    if (transaction) {
      await updateExpense(transaction.id, data);
    } else {
      await createExpense(data);
    }

    router.push('/expenses');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount - Large, prominent */}
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
          Amount
        </label>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-light text-gray-500">R$</span>
          <input
            type="number"
            id="amount"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="block w-full text-4xl font-bold border-0 border-b-2 border-gray-300 px-0 py-2 focus:border-blue-500 focus:outline-none focus:ring-0"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Groceries at Walmart"
        />
      </div>

      {/* Category - Visual grid */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
        <div className="grid grid-cols-4 gap-3">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition ${
                categoryId === category.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                style={{ backgroundColor: category.color }}
              >
                {category.icon}
              </div>
              <span className="text-xs font-medium text-center">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Account */}
      <div>
        <label htmlFor="account" className="block text-sm font-medium text-gray-700">
          Account
        </label>
        <select
          id="account"
          value={accountId}
          onChange={(e) => setAccountId(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
          Date (first installment)
        </label>
        <input
          type="date"
          id="dueDate"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Installments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="installments" className="block text-sm font-medium text-gray-700">
            Installments
          </label>
          {installments > 1 && (
            <span className="text-sm text-gray-500">
              {installments}x de R$ {centsToDisplay(perInstallment)}
            </span>
          )}
        </div>
        <input
          type="range"
          id="installments"
          min="1"
          max="24"
          value={installments}
          onChange={(e) => setInstallments(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1x</span>
          <span>{installments}x</span>
          <span>24x</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {transaction ? 'Update' : 'Create'} Expense
        </button>
      </div>
    </form>
  );
}
```

---

## 3. New Expense Page

### Create `/app/expenses/new/page.tsx`

```tsx
import { ExpenseForm } from '@/components/expense-form';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';

export default async function NewExpensePage() {
  const [accounts, categories] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Add Expense</h1>
      <ExpenseForm accounts={accounts} categories={categories} />
    </div>
  );
}
```

---

## 4. Edit Expense Page

### Create `/app/expenses/[id]/page.tsx`

```tsx
import { ExpenseForm } from '@/components/expense-form';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { getTransactionWithEntries } from '@/lib/actions/expenses';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { id: string };
};

export default async function EditExpensePage({ params }: PageProps) {
  const transactionId = parseInt(params.id);

  const [accounts, categories, transaction] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactionWithEntries(transactionId),
  ]);

  if (!transaction) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Edit Expense</h1>
      <ExpenseForm
        accounts={accounts}
        categories={categories}
        transaction={transaction}
      />
    </div>
  );
}
```

---

## 5. Quick Add Button (Floating Action Button)

### Create `/components/ui/fab.tsx`

```tsx
import Link from 'next/link';

export function FAB() {
  return (
    <Link
      href="/expenses/new"
      className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      aria-label="Add expense"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    </Link>
  );
}
```

Add to layout or dashboard page for quick access.

---

## Testing

### Manual test flow:

1. **Create single expense:**
   - Go to `/expenses/new`
   - Enter R$50.00, "Lunch", select category/account
   - Keep installments at 1
   - Submit → redirects to `/expenses`

2. **Create installment expense:**
   - Go to `/expenses/new`
   - Enter R$1200.00, "New phone", 12 installments
   - Submit → creates 1 transaction + 12 entries

3. **Verify in database:**
   ```bash
   turso db shell northstar-finance

   SELECT * FROM transactions;
   SELECT * FROM entries ORDER BY due_date;
   ```

4. **Edit expense:**
   - Click edit on an expense
   - Change installments from 12 to 6
   - Submit → old entries deleted, new ones created

---

## Checkpoint ✓

You should now have:
- ✓ Add expense form with installment slider
- ✓ Visual category selector (grid with icons)
- ✓ Edit expense (same form, prefilled)
- ✓ Transaction creation with automatic entry generation
- ✓ Per-installment amount calculation display

**Next:** Move to `03-expenses-list.md` to view, filter, and manage expenses.
