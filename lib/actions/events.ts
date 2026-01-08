'use server';
import { db } from '@/lib/db';
import { events, recurrenceRules, notifications, notificationJobs, type NewEvent } from '@/lib/schema';
import { eq, and, asc } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { scheduleNotificationJobs } from './notifications';

type ActionResult = { success: true; data?: { id: number } } | { success: false; error: string };

export async function getEvents() {
  try {
    const userId = await getCurrentUserId();
    return await db.select().from(events).where(eq(events.userId, userId)).orderBy(asc(events.startAt));
  } catch (error) {
    console.error('[events:get] Failed:', error);
    return [];
  }
}

export async function getEventById(id: number) {
  try {
    const userId = await getCurrentUserId();
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.userId, userId)))
      .limit(1);
    return event;
  } catch (error) {
    console.error('[events:getById] Failed:', error);
    return undefined;
  }
}

export async function createEvent(data: Omit<NewEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const [event] = await db.insert(events).values({ ...data, userId }).returning();
    await scheduleNotificationJobs('event', event.id, event.startAt);
    revalidatePath('/calendar');
    revalidateTag('events', 'default');
    return { success: true, data: { id: event.id } };
  } catch (error) {
    console.error('[events:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateEvent(id: number, data: Partial<Omit<NewEvent, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.userId, userId)))
      .limit(1);
    
    if (!event) {
      return { success: false, error: await t('errors.notFound') };
    }
    
    await db.update(events).set({ ...data, updatedAt: new Date() }).where(and(eq(events.id, id), eq(events.userId, userId)));
    
    if (data.startAt) {
      await scheduleNotificationJobs('event', id, data.startAt);
    }

    revalidatePath('/calendar');
    revalidateTag('events', 'default');
    return { success: true };
  } catch (error) {
    console.error('[events:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteEvent(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Clean up orphaned data before deleting event
    await db.delete(notificationJobs).where(and(
      eq(notificationJobs.itemType, 'event'),
      eq(notificationJobs.itemId, id)
    ));

    await db.delete(notifications).where(and(
      eq(notifications.itemType, 'event'),
      eq(notifications.itemId, id)
    ));

    await db.delete(recurrenceRules).where(and(
      eq(recurrenceRules.itemType, 'event'),
      eq(recurrenceRules.itemId, id)
    ));

    await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('events', 'default');
    return { success: true };
  } catch (error) {
    console.error('[events:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}

export async function completeEvent(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.update(events).set({ status: 'completed', updatedAt: new Date() }).where(and(eq(events.id, id), eq(events.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('events', 'default');
    return { success: true };
  } catch (error) {
    console.error('[events:complete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function cancelEvent(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await db.update(events).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(events.id, id), eq(events.userId, userId)));
    revalidatePath('/calendar');
    revalidateTag('events', 'default');
    return { success: true };
  } catch (error) {
    console.error('[events:cancel] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}
