'use server';

import { db } from '@/lib/db';
import { billReminders, notificationJobs } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { calculateNextDueDate } from '@/lib/utils/bill-reminders';

export async function scheduleBillReminderNotifications(): Promise<{
  scheduled: number;
  skipped: number;
}> {
  let scheduled = 0;
  let skipped = 0;

  // Get all active bill reminders
  const activeReminders = await db
    .select()
    .from(billReminders)
    .where(eq(billReminders.status, 'active'));

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const reminder of activeReminders) {
    try {
      // Calculate next due date
      const nextDue = calculateNextDueDate(reminder);

      // Only schedule if within next 7 days
      if (nextDue > sevenDaysFromNow) {
        continue;
      }

      // Calculate notification times
      const notifications: Array<{ offset: number; scheduledAt: Date }> = [];

      if (reminder.notify2DaysBefore) {
        const scheduledAt = new Date(nextDue.getTime() - 2 * 24 * 60 * 60 * 1000);
        if (scheduledAt > now) {
          notifications.push({ offset: -2880, scheduledAt });
        }
      }

      if (reminder.notify1DayBefore) {
        const scheduledAt = new Date(nextDue.getTime() - 1 * 24 * 60 * 60 * 1000);
        if (scheduledAt > now) {
          notifications.push({ offset: -1440, scheduledAt });
        }
      }

      if (reminder.notifyOnDueDay) {
        const scheduledAt = nextDue;
        if (scheduledAt > now) {
          notifications.push({ offset: 0, scheduledAt });
        }
      }

      // Create notification jobs
      for (const notification of notifications) {
        // Check if job already exists
        const existingJobs = await db
          .select()
          .from(notificationJobs)
          .where(
            and(
              eq(notificationJobs.itemType, 'bill_reminder'),
              eq(notificationJobs.itemId, reminder.id),
              eq(notificationJobs.scheduledAt, notification.scheduledAt),
              eq(notificationJobs.status, 'pending')
            )
          )
          .limit(1);

        if (existingJobs.length > 0) {
          skipped++;
          continue;
        }

        // Create new job
        await db.insert(notificationJobs).values({
          itemType: 'bill_reminder',
          itemId: reminder.id,
          notificationId: null,
          channel: 'email',
          scheduledAt: notification.scheduledAt,
          status: 'pending',
          attempts: 0,
        });

        scheduled++;
      }
    } catch (error) {
      console.error('[bill-reminder-jobs:schedule] Failed:', error, {
        reminderId: reminder.id,
        reminderName: reminder.name,
      });
    }
  }

  console.log('[bill-reminder-jobs:schedule] Completed:', {
    scheduled,
    skipped,
    totalReminders: activeReminders.length,
  });

  return { scheduled, skipped };
}
