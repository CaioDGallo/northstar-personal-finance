'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { tasks, recurrenceRules, notifications, notificationJobs, type NewTask } from '@/lib/schema';
import { eq, and, asc } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { scheduleNotificationJobs } from './notifications';

type ActionResult = { success: true } | { success: false; error: string };

export const getTasks = cache(async () => {
  try {
    const userId = await getCurrentUserId();
    return await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.dueAt));
  } catch (error) {
    console.error('[tasks:get] Failed:', error);
    return [];
  }
});

export async function getTaskById(id: number) {
  try {
    const userId = await getCurrentUserId();
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .limit(1);
    return task;
  } catch (error) {
    console.error('[tasks:getById] Failed:', error);
    return undefined;
  }
}

export async function createTask(data: Omit<NewTask, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const [task] = await db.insert(tasks).values({ ...data, userId }).returning();
    await scheduleNotificationJobs('task', task.id, task.dueAt);
    revalidatePath('/calendar');
    revalidateTag('tasks', 'default');
    return { success: true };
  } catch (error) {
    console.error('[tasks:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateTask(id: number, data: Partial<Omit<NewTask, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .limit(1);
    
    if (!task) {
      return { success: false, error: await t('errors.notFound') };
    }
    
    await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    
    if (data.dueAt) {
      await scheduleNotificationJobs('task', id, data.dueAt);
    }

    revalidatePath('/calendar');
    revalidateTag('tasks', 'default');
    return { success: true };
  } catch (error) {
    console.error('[tasks:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteTask(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Clean up orphaned data before deleting task
    await db.delete(notificationJobs).where(and(
      eq(notificationJobs.itemType, 'task'),
      eq(notificationJobs.itemId, id)
    ));

    await db.delete(notifications).where(and(
      eq(notifications.itemType, 'task'),
      eq(notifications.itemId, id)
    ));

    await db.delete(recurrenceRules).where(and(
      eq(recurrenceRules.itemType, 'task'),
      eq(recurrenceRules.itemId, id)
    ));

    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('tasks', 'default');
    return { success: true };
  } catch (error) {
    console.error('[tasks:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}

export async function completeTask(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.update(tasks).set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('tasks', 'default');
    return { success: true };
  } catch (error) {
    console.error('[tasks:complete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function cancelTask(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.update(tasks).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('tasks', 'default');
    return { success: true };
  } catch (error) {
    console.error('[tasks:cancel] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function startTask(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('tasks', 'default');
    return { success: true };
  } catch (error) {
    console.error('[tasks:start] Failed:', error);
    return { success: false, error: await t('errors.failedToUpdate') };
  }
}
