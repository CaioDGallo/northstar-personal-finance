'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { income, categories, accounts } from '@/lib/schema';
import { eq, and, gte, lte, desc, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateIncomeData = {
  description: string;
  amount: number; // cents
  categoryId: number;
  accountId: number;
  receivedDate: string; // 'YYYY-MM-DD'
};

export async function createIncome(data: CreateIncomeData) {
  // Validate inputs
  if (!data.description || data.description.trim().length === 0) {
    throw new Error('Description is required');
  }
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error('Amount must be a positive integer (cents)');
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error('Invalid category ID');
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error('Invalid account ID');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.receivedDate)) {
    throw new Error('Invalid date format (expected YYYY-MM-DD)');
  }

  try {
    await db.insert(income).values({
      description: data.description.trim(),
      amount: data.amount,
      categoryId: data.categoryId,
      accountId: data.accountId,
      receivedDate: data.receivedDate,
    });

    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to create income:', error);
    throw new Error('Failed to create income. Please try again.');
  }
}

export async function updateIncome(incomeId: number, data: CreateIncomeData) {
  // Validate inputs
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error('Invalid income ID');
  }
  if (!data.description || data.description.trim().length === 0) {
    throw new Error('Description is required');
  }
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error('Amount must be a positive integer (cents)');
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error('Invalid category ID');
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error('Invalid account ID');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.receivedDate)) {
    throw new Error('Invalid date format (expected YYYY-MM-DD)');
  }

  try {
    await db
      .update(income)
      .set({
        description: data.description.trim(),
        amount: data.amount,
        categoryId: data.categoryId,
        accountId: data.accountId,
        receivedDate: data.receivedDate,
      })
      .where(eq(income.id, incomeId));

    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to update income:', error);
    throw new Error('Failed to update income. Please try again.');
  }
}

export async function deleteIncome(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error('Invalid income ID');
  }

  try {
    await db.delete(income).where(eq(income.id, incomeId));

    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to delete income:', error);
    throw new Error('Failed to delete income. Please try again.');
  }
}

export type IncomeFilters = {
  yearMonth?: string; // 'YYYY-MM'
  categoryId?: number;
  accountId?: number;
  status?: 'all' | 'received' | 'pending';
};

export const getIncome = cache(async (filters: IncomeFilters = {}) => {
  const conditions = [];

  // Filter by month
  if (filters.yearMonth) {
    const [year, month] = filters.yearMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth}`;

    conditions.push(gte(income.receivedDate, startDate));
    conditions.push(lte(income.receivedDate, endDate));
  }

  // Filter by category
  if (filters.categoryId) {
    conditions.push(eq(income.categoryId, filters.categoryId));
  }

  // Filter by account
  if (filters.accountId) {
    conditions.push(eq(income.accountId, filters.accountId));
  }

  // Filter by status
  if (filters.status === 'received') {
    conditions.push(isNotNull(income.receivedAt));
  } else if (filters.status === 'pending') {
    conditions.push(isNull(income.receivedAt));
  }

  const results = await db
    .select({
      id: income.id,
      description: income.description,
      amount: income.amount,
      receivedDate: income.receivedDate,
      receivedAt: sql<string | null>`${income.receivedAt}::text`,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountId: accounts.id,
      accountName: accounts.name,
    })
    .from(income)
    .innerJoin(categories, eq(income.categoryId, categories.id))
    .innerJoin(accounts, eq(income.accountId, accounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(income.receivedDate), desc(income.createdAt));

  return results;
});

export async function markIncomeReceived(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error('Invalid income ID');
  }

  try {
    await db
      .update(income)
      .set({ receivedAt: new Date() })
      .where(eq(income.id, incomeId));

    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark income as received:', error);
    throw new Error('Failed to update income status. Please try again.');
  }
}

export async function markIncomePending(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error('Invalid income ID');
  }

  try {
    await db
      .update(income)
      .set({ receivedAt: null })
      .where(eq(income.id, incomeId));

    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark income as pending:', error);
    throw new Error('Failed to update income status. Please try again.');
  }
}

export async function updateIncomeCategory(incomeId: number, categoryId: number) {
  await db
    .update(income)
    .set({ categoryId })
    .where(eq(income.id, incomeId));

  revalidatePath('/income');
  revalidatePath('/dashboard');
}

export async function bulkUpdateIncomeCategories(
  incomeIds: number[],
  categoryId: number
) {
  await db
    .update(income)
    .set({ categoryId })
    .where(inArray(income.id, incomeIds));

  revalidatePath('/income');
  revalidatePath('/dashboard');
}
