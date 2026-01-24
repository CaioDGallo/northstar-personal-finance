'use server';

import { cache } from 'react';
import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { income, categories, accounts } from '@/lib/schema';
import { eq, and, gte, lte, desc, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { guardCrudOperation } from '@/lib/rate-limit-guard';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { incrementCategoryFrequency, transferCategoryFrequency } from '@/lib/actions/category-frequency';
import { getPostHogClient } from '@/lib/posthog-server';
import { trackUserActivity } from '@/lib/analytics';

export type CreateIncomeData = {
  description?: string;
  amount: number; // cents
  categoryId: number;
  accountId: number;
  receivedDate: string; // 'YYYY-MM-DD'
};

export async function createIncome(data: CreateIncomeData) {
  await guardCrudOperation(); // Rate limiting

  // Validate inputs
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

    // Generate description from category if empty
    let finalDescription = data.description?.trim();
    if (!finalDescription) {
      const [category] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, data.categoryId)))
        .limit(1);
      finalDescription = category?.name || 'Receita';
    }

    await db.insert(income).values({
      userId,
      description: finalDescription,
      amount: data.amount,
      categoryId: data.categoryId,
      accountId: data.accountId,
      receivedDate: data.receivedDate,
    });

    await syncAccountBalance(data.accountId);

    // Track category frequency for auto-suggestions
    await incrementCategoryFrequency(userId, finalDescription, data.categoryId, 'income');

    // Analytics: Track user activity
    await trackUserActivity({
      userId,
      activityType: 'create_income',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'income_created',
        properties: {
          amount_cents: data.amount,
          category_id: data.categoryId,
          account_id: data.accountId,
        },
      });
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to create income:', error);
    throw new Error(await handleDbError(error, 'errors.failedToCreate'));
  }
}

export async function updateIncome(incomeId: number, data: CreateIncomeData) {
  await guardCrudOperation(); // Rate limiting

  // Validate inputs
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
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

    // Generate description from category if empty
    let finalDescription = data.description?.trim();
    if (!finalDescription) {
      const [category] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, data.categoryId)))
        .limit(1);
      finalDescription = category?.name || 'Receita';
    }

    await db
      .update(income)
      .set({
        description: finalDescription,
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

    // Analytics: Track user activity
    await trackUserActivity({
      userId,
      activityType: 'edit_income',
    });

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to update income:', error);
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function deleteIncome(incomeId: number) {
  await guardCrudOperation(); // Rate limiting

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

    // Analytics: Track user activity
    await trackUserActivity({
      userId,
      activityType: 'delete_income',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'income_deleted',
        properties: {
          income_id: incomeId,
        },
      });
    }

    revalidateTag(`user-${userId}`, {});
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

  return unstable_cache(
    async () => {
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
      ignored: income.ignored,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountId: accounts.id,
    accountName: accounts.name,
    accountType: accounts.type,
    bankLogo: accounts.bankLogo,
    replenishCategoryId: income.replenishCategoryId,
    replenishCategoryName: sql<string | null>`replenish_cat.name`,
    replenishCategoryColor: sql<string | null>`replenish_cat.color`,
  })

    .from(income)
    .innerJoin(categories, eq(income.categoryId, categories.id))
    .innerJoin(accounts, eq(income.accountId, accounts.id))
    .leftJoin(
      sql`categories AS replenish_cat`,
      sql`${income.replenishCategoryId} = replenish_cat.id`
    )
      .where(and(...conditions))
      .orderBy(desc(income.receivedDate), desc(income.createdAt));

      return results;
    },
    ['income', userId, filters.yearMonth || 'all', filters.categoryId?.toString() || 'all', filters.accountId?.toString() || 'all', filters.status || 'all'],
    { tags: [`user-${userId}`], revalidate: 300 }
  )();
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

    revalidateTag(`user-${userId}`, {});
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

    revalidateTag(`user-${userId}`, {});
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

  // Get old category and description for frequency transfer
  const [incomeRecord] = await db
    .select({ description: income.description, categoryId: income.categoryId })
    .from(income)
    .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

  if (!incomeRecord) {
    throw new Error(await t('errors.incomeNotFound'));
  }

  await db
    .update(income)
    .set({ categoryId })
    .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

  // Transfer frequency from old to new category
  if (incomeRecord.description) {
    await transferCategoryFrequency(
      userId,
      incomeRecord.description,
      incomeRecord.categoryId,
      categoryId,
      'income'
    );
  }

  revalidateTag(`user-${userId}`, {});
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

    // Get old categories and descriptions for frequency transfer
    const oldIncomes = await db
      .select({ id: income.id, description: income.description, categoryId: income.categoryId })
      .from(income)
      .where(and(eq(income.userId, userId), inArray(income.id, incomeIds)));

    await db
      .update(income)
      .set({ categoryId })
      .where(and(eq(income.userId, userId), inArray(income.id, incomeIds)));

    // Transfer frequency for each income record
    for (const inc of oldIncomes) {
      if (inc.description) {
        await transferCategoryFrequency(userId, inc.description, inc.categoryId, categoryId, 'income');
      }
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to bulk update income categories:', { incomeIds, categoryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function toggleIgnoreIncome(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }

  try {
    const userId = await getCurrentUserId();

    // Get current state
    const [record] = await db
      .select({ ignored: income.ignored, accountId: income.accountId })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!record) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    // Toggle ignored state
    const newIgnored = !record.ignored;

    await db
      .update(income)
      .set({ ignored: newIgnored })
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    // Sync account balance
    await syncAccountBalance(record.accountId);

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/income');
    revalidatePath('/budgets');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to toggle ignore income:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function setIncomeReplenishment(
  incomeId: number,
  replenishCategoryId: number | null
) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }
  if (replenishCategoryId !== null && (!Number.isInteger(replenishCategoryId) || replenishCategoryId <= 0)) {
    throw new Error(await t('errors.invalidCategoryId'));
  }

  try {
    const userId = await getCurrentUserId();

    // Validate income exists and belongs to user
    const [incomeRecord] = await db
      .select({ id: income.id })
      .from(income)
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!incomeRecord) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    // If setting a category, validate it's an expense category
    if (replenishCategoryId !== null) {
      const [category] = await db
        .select({ id: categories.id, type: categories.type })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, replenishCategoryId)))
        .limit(1);

      if (!category) {
        throw new Error(await t('errors.invalidCategoryId'));
      }
      if (category.type !== 'expense') {
        throw new Error('Replenishment category must be an expense category');
      }
    }

    // Update income record
    await db
      .update(income)
      .set({ replenishCategoryId })
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/income');
    revalidatePath('/budgets');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to set income replenishment:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function getReplenishableCategories() {
  try {
    const userId = await getCurrentUserId();

    // Return all expense categories for the user
    const expenseCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.type, 'expense')))
      .orderBy(categories.name);

    return expenseCategories;
  } catch (error) {
    console.error('Failed to get replenishable categories:', error);
    throw new Error(await handleDbError(error, 'errors.failedToLoad'));
  }
}
