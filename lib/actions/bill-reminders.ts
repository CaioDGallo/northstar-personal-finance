'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { billReminders, type NewBillReminder, type BillReminder } from '@/lib/schema';
import { eq, and, or, isNull, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { calculateNextDueDate } from '@/lib/utils/bill-reminders';
import { getCurrentYearMonth } from '@/lib/utils';

type ActionResult = { success: true; data?: { id: number } } | { success: false; error: string };

export const getBillReminders = cache(async () => {
  const userId = await getCurrentUserId();
  return await db
    .select()
    .from(billReminders)
    .where(eq(billReminders.userId, userId))
    .orderBy(billReminders.name);
});

export async function createBillReminder(
  data: Omit<NewBillReminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Validation
    if (!data.name?.trim()) {
      throw new Error(await t('errors.nameRequired'));
    }
    if (!data.dueDay || data.dueDay < 1 || data.dueDay > 31) {
      throw new Error(await t('errors.invalidDueDay'));
    }

    const [reminder] = await db
      .insert(billReminders)
      .values({ ...data, userId })
      .returning();

    revalidatePath('/reminders');
    return { success: true, data: { id: reminder.id } };
  } catch (error) {
    console.error('[bill-reminders:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateBillReminder(
  id: number,
  data: Partial<Omit<NewBillReminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Validation
    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error(await t('errors.nameRequired'));
    }
    if (data.dueDay !== undefined && (data.dueDay < 1 || data.dueDay > 31)) {
      throw new Error(await t('errors.invalidDueDay'));
    }

    await db
      .update(billReminders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(billReminders.id, id), eq(billReminders.userId, userId)));

    revalidatePath('/reminders');
    return { success: true };
  } catch (error) {
    console.error('[bill-reminders:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteBillReminder(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db
      .delete(billReminders)
      .where(and(eq(billReminders.id, id), eq(billReminders.userId, userId)));

    revalidatePath('/reminders');
    return { success: true };
  } catch (error) {
    console.error('[bill-reminders:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}

export async function acknowledgeBillReminder(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const currentMonth = getCurrentYearMonth();

    await db
      .update(billReminders)
      .set({ lastAcknowledgedMonth: currentMonth, updatedAt: new Date() })
      .where(and(eq(billReminders.id, id), eq(billReminders.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error('[bill-reminders:acknowledge] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export type BillReminderWithDue = BillReminder & { nextDue: Date };

export async function getPendingBillReminders(): Promise<BillReminderWithDue[]> {
  const userId = await getCurrentUserId();
  const currentMonth = getCurrentYearMonth();

  const reminders = await db
    .select()
    .from(billReminders)
    .where(
      and(
        eq(billReminders.userId, userId),
        eq(billReminders.status, 'active'),
        or(
          isNull(billReminders.lastAcknowledgedMonth),
          ne(billReminders.lastAcknowledgedMonth, currentMonth)
        )
      )
    );

  // Calculate next due date for each reminder
  const now = new Date();
  const remindersWithDue: BillReminderWithDue[] = [];

  for (const reminder of reminders) {
    const nextDue = calculateNextDueDate(reminder);
    const daysUntil = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Only include reminders due within 3 days
    if (daysUntil >= 0 && daysUntil <= 3) {
      remindersWithDue.push({ ...reminder, nextDue });
    }
  }

  return remindersWithDue;
}
