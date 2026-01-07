'use server';

import { db } from '@/lib/db';
import { notifications, notificationJobs, type NewNotification } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { t } from '@/lib/i18n/server-errors';

type ActionResult = { success: true } | { success: false; error: string };

export async function createNotification(data: Omit<NewNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<ActionResult> {
  try {
    await db.insert(notifications).values(data);
    revalidateTag('notifications', 'max');
    return { success: true };
  } catch (error) {
    console.error('[notifications:create] Failed:', error);
    return { success: false, error: await t('errors.failedToCreate') };
  }
}

export async function updateNotification(id: number, data: Partial<Omit<NewNotification, 'id' | 'createdAt'>>): Promise<ActionResult> {
  try {
    await db.update(notifications).set({ ...data, updatedAt: new Date() }).where(eq(notifications.id, id));
    revalidateTag('notifications', 'max');
    return { success: true };
  } catch (error) {
    console.error('[notifications:update] Failed:', error);
    return { success: false, error: await t('errors.failedToUpdate') };
  }
}

export async function deleteNotification(id: number): Promise<ActionResult> {
  try {
    await db.delete(notifications).where(eq(notifications.id, id));
    revalidateTag('notifications', 'max');
    return { success: true };
  } catch (error) {
    console.error('[notifications:delete] Failed:', error);
    return { success: false, error: await t('errors.failedToDelete') };
  }
}

export async function getNotificationsByItem(itemType: 'event' | 'task', itemId: number) {
  return await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.itemType, itemType),
      eq(notifications.itemId, itemId)
    ));
}

export async function scheduleNotificationJobs(itemType: 'event' | 'task', itemId: number, triggerDate: Date) {
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
}
