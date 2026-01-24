'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { categories, transactions, income, type NewCategory } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { guardCrudOperation } from '@/lib/rate-limit-guard';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { getPostHogClient } from '@/lib/posthog-server';
import { trackFirstCustomCategory, trackUserActivity } from '@/lib/analytics';
import { users } from '@/lib/auth-schema';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export const getCategories = cache(async (type?: 'expense' | 'income') => {
  const userId = await getCurrentUserId();
  if (type) {
    return await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.type, type))).orderBy(categories.name);
  }
  return await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.name);
});

// Internal function for use by cached helpers (can't call getCurrentUserId inside unstable_cache)
export async function getCategoriesByUser(userId: string, type?: 'expense' | 'income') {
  if (type) {
    return await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.type, type))).orderBy(categories.name);
  }
  return await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.name);
}

export type RecentCategory = Pick<
  typeof categories.$inferSelect,
  'id' | 'name' | 'color' | 'icon'
>;

export async function getRecentCategories(
  type: 'expense' | 'income',
  limit = 3
): Promise<RecentCategory[]> {
  const userId = await getCurrentUserId();

  const sqlQuery = type === 'expense'
    ? sql<RecentCategory>`
      SELECT DISTINCT ON (category_id)
        ${categories.id} AS id,
        ${categories.name} AS name,
        ${categories.color} AS color,
        ${categories.icon} AS icon,
        ${transactions.createdAt} AS created_at
      FROM ${transactions}
      INNER JOIN ${categories}
        ON ${transactions.categoryId} = ${categories.id}
      WHERE ${transactions.userId} = ${userId}
        AND ${transactions.ignored} = false
      ORDER BY category_id, created_at DESC
      LIMIT ${limit}
    `
    : sql<RecentCategory>`
      SELECT DISTINCT ON (category_id)
        ${categories.id} AS id,
        ${categories.name} AS name,
        ${categories.color} AS color,
        ${categories.icon} AS icon,
        ${income.createdAt} AS created_at
      FROM ${income}
      INNER JOIN ${categories}
        ON ${income.categoryId} = ${categories.id}
      WHERE ${income.userId} = ${userId}
        AND ${income.ignored} = false
      ORDER BY category_id, created_at DESC
      LIMIT ${limit}
    `;

  const results = await db.execute(sqlQuery);

  return results.rows as RecentCategory[];
}

export async function createCategory(data: Omit<NewCategory, 'id' | 'userId' | 'createdAt'>): Promise<ActionResult<{ id: number }>> {
  try {
    await guardCrudOperation(); // Rate limiting

    const userId = await getCurrentUserId();
    const [created] = await db.insert(categories).values({ ...data, userId }).returning({ id: categories.id });

    // Analytics: Track first custom category creation
    const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);

    if (user?.createdAt) {
      await trackFirstCustomCategory({
        userId,
        categoryType: data.type || 'expense',
        isImportDefault: data.isImportDefault || false,
        userCreatedAt: user.createdAt,
      });
    }

    await trackUserActivity({
      userId,
      activityType: 'create_category',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'category_created',
        properties: {
          category_type: data.type,
          has_icon: data.icon !== null && data.icon !== undefined,
        },
      });
    }

    revalidatePath('/settings/categories');
    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
    revalidateTag(`user-${userId}`, 'max');
    revalidateTag('categories', 'max');
    if (data.type === 'expense') {
      revalidateTag('expense-categories', 'max');
    } else if (data.type === 'income') {
      revalidateTag('income-categories', 'max');
    }
    return { success: true, data: { id: created.id } };
  } catch (error) {
    console.error('[categories:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateCategory(id: number, data: Partial<Omit<NewCategory, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    await guardCrudOperation(); // Rate limiting

    const userId = await getCurrentUserId();
    await db.update(categories).set(data).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath('/settings/categories');
    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
    revalidateTag(`user-${userId}`, 'max');
    revalidateTag('categories', 'max');
    revalidateTag('expense-categories', 'max');
    revalidateTag('income-categories', 'max');
    return { success: true };
  } catch (error) {
    console.error('[categories:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdateCategory') };
  }
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  try {
    await guardCrudOperation(); // Rate limiting

    const userId = await getCurrentUserId();

    // Check if category is used by any transactions
    const usedByTransactions = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.categoryId, id), eq(transactions.userId, userId)))
      .limit(1);

    if (usedByTransactions.length > 0) {
      return { success: false, error: await t('errors.cannotDeleteCategoryWithTransactions') };
    }

    // Check if category is used by any income
    const usedByIncome = await db
      .select({ id: income.id })
      .from(income)
      .where(and(eq(income.categoryId, id), eq(income.userId, userId)))
      .limit(1);

    if (usedByIncome.length > 0) {
      return { success: false, error: await t('errors.cannotDeleteCategoryWithIncome') };
    }

    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath('/settings/categories');
    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
    revalidateTag(`user-${userId}`, 'max');
    revalidateTag('categories', 'max');
    revalidateTag('expense-categories', 'max');
    revalidateTag('income-categories', 'max');
    return { success: true };
  } catch (error) {
    console.error('[categories:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}

export async function setImportDefault(categoryId: number, isDefault: boolean): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Get the category to check its type
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (!category) {
      return { success: false, error: await t('errors.categoryNotFound') };
    }

    // If setting to true, unset any existing default of the same type
    if (isDefault) {
      await db
        .update(categories)
        .set({ isImportDefault: false })
        .where(and(
          eq(categories.userId, userId),
          eq(categories.type, category.type),
          eq(categories.isImportDefault, true)
        ));
    }

    // Update the target category
    await db
      .update(categories)
      .set({ isImportDefault: isDefault })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

    revalidatePath('/settings/categories');
    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
    revalidateTag(`user-${userId}`, 'max');
    revalidateTag('categories', 'max');
    revalidateTag('expense-categories', 'max');
    revalidateTag('income-categories', 'max');

    return { success: true };
  } catch (error) {
    console.error('[categories:setImportDefault] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdateCategory') };
  }
}

export async function getDefaultImportCategories(): Promise<{
  expense: typeof categories.$inferSelect | null;
  income: typeof categories.$inferSelect | null;
}> {
  const userId = await getCurrentUserId();

  const [expenseCategory] = await db
    .select()
    .from(categories)
    .where(and(
      eq(categories.userId, userId),
      eq(categories.type, 'expense'),
      eq(categories.isImportDefault, true)
    ))
    .limit(1);

  const [incomeCategory] = await db
    .select()
    .from(categories)
    .where(and(
      eq(categories.userId, userId),
      eq(categories.type, 'income'),
      eq(categories.isImportDefault, true)
    ))
    .limit(1);

  return {
    expense: expenseCategory || null,
    income: incomeCategory || null,
  };
}
