'use server';

import { db } from '@/lib/db';
import { notifications, notificationJobs, events, tasks, type NewNotification } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';

type ActionResult = { success: true } | { success: false; error: string };

async function verifyNotificationOwnership(notificationId: number, userId: string): Promise<boolean> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification) return false;

  // Verify ownership through parent item
  if (notification.itemType === 'event') {
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, notification.itemId), eq(events.userId, userId)))
      .limit(1);
    return !!event;
  } else {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, notification.itemId), eq(tasks.userId, userId)))
      .limit(1);
    return !!task;
  }
}

async function verifyItemOwnership(itemType: 'event' | 'task', itemId: number, userId: string): Promise<boolean> {
  if (itemType === 'event') {
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, itemId), eq(events.userId, userId)))
      .limit(1);
    return !!event;
  } else {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, itemId), eq(tasks.userId, userId)))
      .limit(1);
    return !!task;
  }
}

export async function createNotification(data: Omit<NewNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<ActionResult> {
  try {
    await db.insert(notifications).values(data);
    revalidateTag('notifications', 'max');
    return { success: true };
  } catch (error) {
    console.error('[notifications:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateNotification(id: number, data: Partial<Omit<NewNotification, 'id' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    if (!await verifyNotificationOwnership(id, userId)) {
      return { success: false, error: await t('errors.notFound') };
    }

    await db.update(notifications).set({ ...data, updatedAt: new Date() }).where(eq(notifications.id, id));
    revalidateTag('notifications', 'max');
    return { success: true };
  } catch (error) {
    console.error('[notifications:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteNotification(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    if (!await verifyNotificationOwnership(id, userId)) {
      return { success: false, error: await t('errors.notFound') };
    }

    await db.delete(notifications).where(eq(notifications.id, id));
    revalidateTag('notifications', 'max');
    return { success: true };
  } catch (error) {
    console.error('[notifications:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}

export async function getNotificationsByItem(itemType: 'event' | 'task', itemId: number) {
  const userId = await getCurrentUserId();

  if (!await verifyItemOwnership(itemType, itemId, userId)) {
    return [];
  }

  return await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.itemType, itemType),
      eq(notifications.itemId, itemId)
    ));
}

export async function scheduleNotificationJobs(itemType: 'event' | 'task', itemId: number, triggerDate: Date) {
  try {
    const notificationConfigs = await getNotificationsByItem(itemType, itemId);

    for (const config of notificationConfigs) {
      if (!config.enabled) continue;

      const scheduledAt = new Date(triggerDate.getTime() - config.offsetMinutes * 60000);

      await db.insert(notificationJobs).values({
        itemType,
        itemId,
        notificationId: config.id,
        channel: config.channel,
        scheduledAt,
        status: 'pending',
        attempts: 0,
      });
    }

    revalidateTag('notification-jobs', 'max');
  } catch (error) {
    // Log error but don't propagate - notification scheduling failure shouldn't block item creation
    console.error('[notifications:schedule] Failed to schedule notification jobs:', error, { itemType, itemId });
  }
}
