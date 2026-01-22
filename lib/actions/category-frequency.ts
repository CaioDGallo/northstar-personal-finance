'use server';

import { db } from '@/lib/db';
import { categoryFrequency } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

/**
 * Normalizes a description for frequency lookup
 */
function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

/**
 * Increments the frequency count for a category + description pair
 * Upserts: creates new row if not exists, otherwise increments count and updates lastUsedAt
 */
export async function incrementCategoryFrequency(
  userId: string,
  description: string,
  categoryId: number,
  type: 'expense' | 'income'
): Promise<void> {
  const descriptionNormalized = normalizeDescription(description);

  await db
    .insert(categoryFrequency)
    .values({
      userId,
      descriptionNormalized,
      categoryId,
      type,
      count: 1,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        categoryFrequency.userId,
        categoryFrequency.descriptionNormalized,
        categoryFrequency.categoryId,
        categoryFrequency.type,
      ],
      set: {
        count: sql`${categoryFrequency.count} + 1`,
        lastUsedAt: new Date(),
      },
    });
}

/**
 * Transfers frequency from old category to new category
 * Decrements old, increments new (or creates new if not exists)
 */
export async function transferCategoryFrequency(
  userId: string,
  description: string,
  oldCategoryId: number,
  newCategoryId: number,
  type: 'expense' | 'income'
): Promise<void> {
  const descriptionNormalized = normalizeDescription(description);

  // Decrement old category (but don't go below 1, we keep it for history)
  await db
    .update(categoryFrequency)
    .set({
      count: sql`GREATEST(1, ${categoryFrequency.count} - 1)`,
    })
    .where(
      and(
        eq(categoryFrequency.userId, userId),
        eq(categoryFrequency.descriptionNormalized, descriptionNormalized),
        eq(categoryFrequency.categoryId, oldCategoryId),
        eq(categoryFrequency.type, type)
      )
    );

  // Increment new category
  await incrementCategoryFrequency(userId, description, newCategoryId, type);
}

/**
 * Bulk increment frequency for multiple items
 * Used for imports to efficiently update many records at once
 */
export async function bulkIncrementCategoryFrequency(
  userId: string,
  items: Array<{
    description: string;
    categoryId: number;
    type: 'expense' | 'income';
  }>
): Promise<void> {
  if (items.length === 0) return;

  // Group items by normalized description + category + type
  const grouped = items.reduce(
    (acc, item) => {
      const key = `${normalizeDescription(item.description)}_${item.categoryId}_${item.type}`;
      if (!acc[key]) {
        acc[key] = {
          descriptionNormalized: normalizeDescription(item.description),
          categoryId: item.categoryId,
          type: item.type,
          count: 0,
        };
      }
      acc[key].count++;
      return acc;
    },
    {} as Record<
      string,
      {
        descriptionNormalized: string;
        categoryId: number;
        type: 'expense' | 'income';
        count: number;
      }
    >
  );

  // Batch insert/update all unique combinations
  const values = Object.values(grouped);
  if (values.length === 0) return;

  // Use raw SQL for bulk upsert (Drizzle doesn't support bulk onConflictDoUpdate)
  await db.execute(sql`
    INSERT INTO category_frequency (user_id, description_normalized, category_id, type, count, last_used_at)
    VALUES ${sql.join(
      values.map(
        (v) => sql`(${userId}, ${v.descriptionNormalized}, ${v.categoryId}, ${v.type}, ${v.count}, NOW())`
      ),
      sql`, `
    )}
    ON CONFLICT (user_id, description_normalized, category_id, type)
    DO UPDATE SET
      count = category_frequency.count + EXCLUDED.count,
      last_used_at = NOW()
  `);
}
