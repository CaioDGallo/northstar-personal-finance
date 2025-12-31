'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { categories, transactions, income, type NewCategory } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };

export const getCategories = cache(async (type?: 'expense' | 'income') => {
  if (type) {
    return await db.select().from(categories).where(eq(categories.type, type)).orderBy(categories.name);
  }
  return await db.select().from(categories).orderBy(categories.name);
});

export async function createCategory(data: Omit<NewCategory, 'id' | 'createdAt'>): Promise<ActionResult> {
  try {
    await db.insert(categories).values(data);
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

export async function updateCategory(id: number, data: Partial<Omit<NewCategory, 'id' | 'createdAt'>>): Promise<ActionResult> {
  try {
    await db.update(categories).set(data).where(eq(categories.id, id));
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
    // Check if category is used by any transactions
    const usedByTransactions = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.categoryId, id))
      .limit(1);

    if (usedByTransactions.length > 0) {
      return { success: false, error: 'Cannot delete category with existing transactions' };
    }

    // Check if category is used by any income
    const usedByIncome = await db
      .select({ id: income.id })
      .from(income)
      .where(eq(income.categoryId, id))
      .limit(1);

    if (usedByIncome.length > 0) {
      return { success: false, error: 'Cannot delete category with existing income entries' };
    }

    await db.delete(categories).where(eq(categories.id, id));
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
