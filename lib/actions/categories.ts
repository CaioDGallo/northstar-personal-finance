'use server';

import { db } from '@/lib/db';
import { categories, transactions, type NewCategory } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };

export async function getCategories() {
  return await db.select().from(categories).orderBy(categories.name);
}

export async function createCategory(data: Omit<NewCategory, 'id' | 'createdAt'>): Promise<ActionResult> {
  try {
    await db.insert(categories).values(data);
    revalidatePath('/settings/categories');
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

    await db.delete(categories).where(eq(categories.id, id));
    revalidatePath('/settings/categories');
    return { success: true };
  } catch (error) {
    console.error('[categories:delete] Failed:', error);
    return { success: false, error: 'Failed to delete category. Please try again.' };
  }
}
