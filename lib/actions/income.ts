'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { income, categories, accounts } from '@/lib/schema';
import { eq, and, gte, lte, desc, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { syncAccountBalance } from '@/lib/actions/accounts';

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
    throw new Error(await t('errors.descriptionRequired'));
  }
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(await t('errors.amountPositiveCents'));
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.receivedDate)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }

  try {
    const userId = await getCurrentUserId();

    await db.insert(income).values({
      userId,
      description: data.description.trim(),
      amount: data.amount,
      categoryId: data.categoryId,
      accountId: data.accountId,
      receivedDate: data.receivedDate,
    });

    await syncAccountBalance(data.accountId);

    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to create income:', error);
    throw new Error(await handleDbError(error, 'errors.failedToCreate'));
  }
}

export async function updateIncome(incomeId: number, data: CreateIncomeData) {
  // Validate inputs
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }
  if (!data.description || data.description.trim().length === 0) {
    throw new Error(await t('errors.descriptionRequired'));
  }
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(await t('errors.amountPositiveCents'));
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.receivedDate)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }

  try {
    const userId = await getCurrentUserId();

    const [existing] = await db
      .select({ id: income.id, accountId: income.accountId, receivedAt: income.receivedAt })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!existing) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    await db
      .update(income)
      .set({
        description: data.description.trim(),
        amount: data.amount,
        categoryId: data.categoryId,
        accountId: data.accountId,
        receivedDate: data.receivedDate,
      })
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    await syncAccountBalance(existing.accountId);
    if (existing.accountId !== data.accountId) {
      await syncAccountBalance(data.accountId);
    }

    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to update income:', error);
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function deleteIncome(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }

  try {
    const userId = await getCurrentUserId();

    const [existing] = await db
      .select({ id: income.id, accountId: income.accountId })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!existing) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    await db.delete(income).where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    await syncAccountBalance(existing.accountId);

    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to delete income:', error);
    throw new Error(await handleDbError(error, 'errors.failedToDelete'));
  }
}

export type IncomeFilters = {
  yearMonth?: string; // 'YYYY-MM'
  categoryId?: number;
  accountId?: number;
  status?: 'all' | 'received' | 'pending';
};

export const getIncome = cache(async (filters: IncomeFilters = {}) => {
  const userId = await getCurrentUserId();
  const conditions = [eq(income.userId, userId)];

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
      accountType: accounts.type,
    })
    .from(income)
    .innerJoin(categories, eq(income.categoryId, categories.id))
    .innerJoin(accounts, eq(income.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(income.receivedDate), desc(income.createdAt));

  return results;
});

export async function markIncomeReceived(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }

  try {
    const userId = await getCurrentUserId();

    const [record] = await db
      .select({ id: income.id, accountId: income.accountId })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!record) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    await db
      .update(income)
      .set({ receivedAt: new Date() })
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    await syncAccountBalance(record.accountId);

    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to mark income as received:', error);
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function markIncomePending(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }

  try {
    const userId = await getCurrentUserId();

    const [record] = await db
      .select({ id: income.id, accountId: income.accountId })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!record) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    await db
      .update(income)
      .set({ receivedAt: null })
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    await syncAccountBalance(record.accountId);

    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to mark income as pending:', error);
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function updateIncomeCategory(incomeId: number, categoryId: number) {
  const userId = await getCurrentUserId();

  await db
    .update(income)
    .set({ categoryId })
    .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

  revalidatePath('/income');
  revalidatePath('/dashboard');
}

export async function bulkUpdateIncomeCategories(
  incomeIds: number[],
  categoryId: number
) {
  if (!Array.isArray(incomeIds) || incomeIds.length === 0) {
    throw new Error('Income IDs array is required');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }

  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limited. Try again in ${rateLimit.retryAfter}s.`);
    }

    await db
      .update(income)
      .set({ categoryId })
      .where(and(eq(income.userId, userId), inArray(income.id, incomeIds)));

    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to bulk update income categories:', { incomeIds, categoryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}
