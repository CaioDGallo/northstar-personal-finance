'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, type NewEntry } from '@/lib/schema';
import { eq, and, isNull, isNotNull, desc, sql, inArray } from 'drizzle-orm';
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
  // Validate inputs
  if (!data.description?.trim()) {
    throw new Error('Description is required');
  }
  if (!Number.isInteger(data.totalAmount) || data.totalAmount <= 0) {
    throw new Error('Amount must be a positive integer');
  }
  if (!Number.isInteger(data.installments) || data.installments < 1) {
    throw new Error('Installments must be at least 1');
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error('Invalid category ID');
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error('Invalid account ID');
  }
  if (!data.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    throw new Error('Invalid due date format (expected YYYY-MM-DD)');
  }

  try {
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
  } catch (error) {
    console.error('Failed to create expense:', { data, error });
    throw new Error('Failed to create expense. Please try again.');
  }
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
  // Validate inputs
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error('Invalid transaction ID');
  }
  if (!data.description?.trim()) {
    throw new Error('Description is required');
  }
  if (!Number.isInteger(data.totalAmount) || data.totalAmount <= 0) {
    throw new Error('Amount must be a positive integer');
  }
  if (!Number.isInteger(data.installments) || data.installments < 1) {
    throw new Error('Installments must be at least 1');
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error('Invalid category ID');
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error('Invalid account ID');
  }
  if (!data.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    throw new Error('Invalid due date format (expected YYYY-MM-DD)');
  }

  try {
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
  } catch (error) {
    console.error('Failed to update expense:', { transactionId, data, error });
    throw new Error('Failed to update expense. Please try again.');
  }
}

export async function deleteExpense(transactionId: number) {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error('Invalid transaction ID');
  }

  try {
    // CASCADE will delete entries automatically
    await db.delete(transactions).where(eq(transactions.id, transactionId));
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to delete expense:', { transactionId, error });
    throw new Error('Failed to delete expense. Please try again.');
  }
}

export type ExpenseFilters = {
  yearMonth?: string; // 'YYYY-MM'
  categoryId?: number;
  accountId?: number;
  status?: 'all' | 'paid' | 'pending';
};

export async function getExpenses(filters: ExpenseFilters = {}) {
  const { yearMonth, categoryId, accountId, status = 'all' } = filters;

  const conditions = [];

  // Filter by month using SQL to extract year-month from dueDate
  if (yearMonth) {
    conditions.push(sql`to_char(${entries.dueDate}, 'YYYY-MM') = ${yearMonth}`);
  }

  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId));
  }

  if (accountId) {
    conditions.push(eq(entries.accountId, accountId));
  }

  if (status === 'pending') {
    conditions.push(isNull(entries.paidAt));
  } else if (status === 'paid') {
    conditions.push(isNotNull(entries.paidAt));
  }

  const results = await db
    .select({
      id: entries.id,
      amount: entries.amount,
      dueDate: entries.dueDate,
      paidAt: sql<string | null>`${entries.paidAt}::text`,
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
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(entries.dueDate));

  return results;
}

export async function markEntryPaid(entryId: number) {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error('Invalid entry ID');
  }

  try {
    await db
      .update(entries)
      .set({ paidAt: new Date() })
      .where(eq(entries.id, entryId));

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark entry paid:', { entryId, error });
    throw new Error('Failed to mark entry as paid. Please try again.');
  }
}

export async function markEntryPending(entryId: number) {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error('Invalid entry ID');
  }

  try {
    await db
      .update(entries)
      .set({ paidAt: null })
      .where(eq(entries.id, entryId));

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark entry pending:', { entryId, error });
    throw new Error('Failed to mark entry as pending. Please try again.');
  }
}

export async function updateTransactionCategory(transactionId: number, categoryId: number) {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error('Invalid transaction ID');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error('Invalid category ID');
  }

  try {
    await db
      .update(transactions)
      .set({ categoryId })
      .where(eq(transactions.id, transactionId));

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to update transaction category:', { transactionId, categoryId, error });
    throw new Error('Failed to update category. Please try again.');
  }
}

export async function bulkUpdateTransactionCategories(
  transactionIds: number[],
  categoryId: number
) {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    throw new Error('Transaction IDs array is required');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error('Invalid category ID');
  }

  try {
    await db
      .update(transactions)
      .set({ categoryId })
      .where(inArray(transactions.id, transactionIds));

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to bulk update categories:', { transactionIds, categoryId, error });
    throw new Error('Failed to update categories. Please try again.');
  }
}
