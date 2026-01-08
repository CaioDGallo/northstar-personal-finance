'use server';

import { db } from '@/lib/db';
import { recurrenceRules, events, tasks, type NewRecurrenceRule } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { rrulestr } from 'rrule';
import { getCurrentUserId } from '@/lib/auth';

type ActionResult = { success: true } | { success: false; error: string };

export async function validateRRule(rruleString: string): Promise<ActionResult> {
  try {
    rrulestr(rruleString);
    return { success: true };
  } catch {
    console.error('[recurrence:validate] Failed: Invalid RRULE');
    return { success: false, error: await t('errors.invalidRRule') };
  }
}

export async function createRecurrenceRule(data: Omit<NewRecurrenceRule, 'id' | 'createdAt'>): Promise<ActionResult> {
  try {
    const validation = await validateRRule(data.rrule);
    if (!validation.success) {
      return validation;
    }
    
    await db.insert(recurrenceRules).values(data);
    revalidateTag('recurrence-rules', 'default');
    return { success: true };
  } catch (error) {
    console.error('[recurrence:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateRecurrenceRule(id: number, data: Partial<Omit<NewRecurrenceRule, 'id' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    const [rule] = await db
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.id, id))
      .limit(1);

    if (!rule) {
      return { success: false, error: await t('errors.notFound') };
    }

    if (rule.itemType === 'event') {
      const [event] = await db
        .select()
        .from(events)
        .where(and(eq(events.id, rule.itemId), eq(events.userId, userId)))
        .limit(1);
      if (!event) {
        return { success: false, error: await t('errors.notFound') };
      }
    } else if (rule.itemType === 'task') {
      const [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, rule.itemId), eq(tasks.userId, userId)))
        .limit(1);
      if (!task) {
        return { success: false, error: await t('errors.notFound') };
      }
    }

    if (data.rrule) {
      const validation = await validateRRule(data.rrule);
      if (!validation.success) {
        return validation;
      }
    }

    await db.update(recurrenceRules).set(data).where(eq(recurrenceRules.id, id));
    revalidateTag('recurrence-rules', 'default');
    return { success: true };
  } catch (error) {
    console.error('[recurrence:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteRecurrenceRule(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    const [rule] = await db
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.id, id))
      .limit(1);

    if (!rule) {
      return { success: false, error: await t('errors.notFound') };
    }

    if (rule.itemType === 'event') {
      const [event] = await db
        .select()
        .from(events)
        .where(and(eq(events.id, rule.itemId), eq(events.userId, userId)))
        .limit(1);
      if (!event) {
        return { success: false, error: await t('errors.notFound') };
      }
    } else if (rule.itemType === 'task') {
      const [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, rule.itemId), eq(tasks.userId, userId)))
        .limit(1);
      if (!task) {
        return { success: false, error: await t('errors.notFound') };
      }
    }

    await db.delete(recurrenceRules).where(eq(recurrenceRules.id, id));
    revalidateTag('recurrence-rules', 'default');
    return { success: true };
  } catch (error) {
    console.error('[recurrence:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}

export async function getRecurrenceRuleByItem(itemType: 'event' | 'task', itemId: number) {
  try {
    const userId = await getCurrentUserId();
    if (itemType === 'event') {
      const [row] = await db
        .select({ rule: recurrenceRules })
        .from(recurrenceRules)
        .innerJoin(events, and(eq(events.id, recurrenceRules.itemId), eq(events.userId, userId)))
        .where(and(eq(recurrenceRules.itemType, 'event'), eq(recurrenceRules.itemId, itemId)))
        .limit(1);
      return row?.rule;
    }

    const [row] = await db
      .select({ rule: recurrenceRules })
      .from(recurrenceRules)
      .innerJoin(tasks, and(eq(tasks.id, recurrenceRules.itemId), eq(tasks.userId, userId)))
      .where(and(eq(recurrenceRules.itemType, 'task'), eq(recurrenceRules.itemId, itemId)))
      .limit(1);
    return row?.rule;
  } catch (error) {
    console.error('[recurrence:getByItem] Failed:', error);
    return undefined;
  }
}
