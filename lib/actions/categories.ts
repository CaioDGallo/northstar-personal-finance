'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { categories, transactions, income, type NewCategory } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';

type ActionResult = { success: true } | { success: false; error: string };

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

export async function createCategory(data: Omit<NewCategory, 'id' | 'userId' | 'createdAt'>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.insert(categories).values({ ...data, userId });
    revalidatePath('/settings/categories');
    revalidateTag('categories', 'max');
    if (data.type === 'expense') {
      revalidateTag('expense-categories', 'max');
    } else if (data.type === 'income') {
      revalidateTag('income-categories', 'max');
    }
    return { success: true };
  } catch (error) {
    console.error('[categories:create] Failed:', error);
    return { success: false, error: 'Failed to create category. Please try again.' };
  }
}

export async function updateCategory(id: number, data: Partial<Omit<NewCategory, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.update(categories).set(data).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath('/settings/categories');
    revalidateTag('categories', 'max');
    revalidateTag('expense-categories', 'max');
    revalidateTag('income-categories', 'max');
    return { success: true };
  } catch (error) {
    console.error('[categories:update] Failed:', error);
    return { success: false, error: 'Failed to update category. Please try again.' };
  }
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Check if category is used by any transactions
    const usedByTransactions = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.categoryId, id), eq(transactions.userId, userId)))
      .limit(1);

    if (usedByTransactions.length > 0) {
      return { success: false, error: 'Cannot delete category with existing transactions' };
    }

    // Check if category is used by any income
    const usedByIncome = await db
      .select({ id: income.id })
      .from(income)
      .where(and(eq(income.categoryId, id), eq(income.userId, userId)))
      .limit(1);

    if (usedByIncome.length > 0) {
      return { success: false, error: 'Cannot delete category with existing income entries' };
    }

    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath('/settings/categories');
    revalidateTag('categories', 'max');
    revalidateTag('expense-categories', 'max');
    revalidateTag('income-categories', 'max');
    return { success: true };
  } catch (error) {
    console.error('[categories:delete] Failed:', error);
    return { success: false, error: 'Failed to delete category. Please try again.' };
  }
}
