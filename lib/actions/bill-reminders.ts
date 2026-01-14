'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { billReminders, type NewBillReminder, type BillReminder } from '@/lib/schema';
import { eq, and, or, isNull, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { calculateNextDueDate, getCurrentYearMonthInTimeZone } from '@/lib/utils/bill-reminders';
import { getUserSettings } from '@/lib/actions/user-settings';

type ActionResult = { success: true; data?: { id: number } } | { success: false; error: string };

export const getBillReminders = cache(async () => {
  const userId = await getCurrentUserId();
  return await db
    .select()
    .from(billReminders)
    .where(eq(billReminders.userId, userId))
    .orderBy(billReminders.name);
});

export const getActiveBillReminders = cache(async (): Promise<BillReminder[]> => {
  try {
    const userId = await getCurrentUserId();
    return await db
      .select()
      .from(billReminders)
      .where(and(eq(billReminders.userId, userId), eq(billReminders.status, 'active')))
      .orderBy(billReminders.name);
  } catch (error) {
    console.error('[bill-reminders:getActive] Failed:', error);
    return [];
  }
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
    if (data.dueDay == null) {
      throw new Error(await t('errors.invalidDueDay'));
    }

    const recurrenceType = data.recurrenceType ?? 'monthly';
    if (recurrenceType === 'weekly') {
      if (data.dueDay < 0 || data.dueDay > 6) {
        throw new Error(await t('errors.invalidDueDay'));
      }
    } else if (data.dueDay < 1 || data.dueDay > 31) {
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
    if (data.dueDay !== undefined || data.recurrenceType !== undefined) {
      let dueDay = data.dueDay;
      let recurrenceType = data.recurrenceType;

      if (dueDay === undefined || recurrenceType === undefined) {
        const [existing] = await db
          .select({
            dueDay: billReminders.dueDay,
            recurrenceType: billReminders.recurrenceType,
          })
          .from(billReminders)
          .where(and(eq(billReminders.id, id), eq(billReminders.userId, userId)))
          .limit(1);

        dueDay = dueDay ?? existing?.dueDay;
        recurrenceType = recurrenceType ?? existing?.recurrenceType ?? 'monthly';
      }

      if (dueDay == null) {
        throw new Error(await t('errors.invalidDueDay'));
      }

      if (recurrenceType === 'weekly') {
        if (dueDay < 0 || dueDay > 6) {
          throw new Error(await t('errors.invalidDueDay'));
        }
      } else if (dueDay < 1 || dueDay > 31) {
        throw new Error(await t('errors.invalidDueDay'));
      }
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
    const settings = await getUserSettings();
    const timeZone = settings?.timezone || 'UTC';
    const currentMonth = getCurrentYearMonthInTimeZone(timeZone);

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
  const settings = await getUserSettings();
  const timeZone = settings?.timezone || 'UTC';
  const currentMonth = getCurrentYearMonthInTimeZone(timeZone);

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

  const now = new Date();
  const remindersWithDue: BillReminderWithDue[] = [];

  for (const reminder of reminders) {
    const nextDue = calculateNextDueDate(reminder, { now, timeZone });
    const daysUntil = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Only include reminders due within 3 days
    if (daysUntil >= 0 && daysUntil <= 3) {
      remindersWithDue.push({ ...reminder, nextDue });
    }
  }

  return remindersWithDue;
}
