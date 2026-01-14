'use server';

import { db } from '@/lib/db';
import { notificationJobs, events, tasks, userSettings, billReminders, categories } from '@/lib/schema';
import { eq, and, lte } from 'drizzle-orm';
import { generateBillReminderHtml, generateBillReminderText } from '@/lib/email/bill-reminder-template';
import { calculateNextDueDate } from '@/lib/utils/bill-reminders';
import { defaultLocale, type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

interface ProcessNotificationJobResult {
  processed: number;
  failed: number;
}

type NotificationJob = typeof notificationJobs.$inferSelect;
type EventItem = typeof events.$inferSelect;
type TaskItem = typeof tasks.$inferSelect;
type BillReminderItem = typeof billReminders.$inferSelect;

function formatDateTimeForUser(date: Date, timeZone?: string | null): string {
  const resolvedTimeZone = timeZone || 'UTC';

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: resolvedTimeZone,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export async function processPendingNotificationJobs(): Promise<ProcessNotificationJobResult> {
  let processed = 0;
  let failed = 0;
  
  const now = new Date();
  
  const pendingJobs = await db
    .select({
      job: notificationJobs,
    })
    .from(notificationJobs)
    .where(and(
      eq(notificationJobs.status, 'pending'),
      lte(notificationJobs.scheduledAt, now)
    ))
    .limit(100);
  
  for (const { job } of pendingJobs) {
    try {
      let isValid = false;
      let itemData: EventItem | TaskItem | BillReminderItem | null = null;
      let userId: string | null = null;

      if (job.itemType === 'event') {
        const result = await db
          .select()
          .from(events)
          .where(eq(events.id, job.itemId))
          .limit(1);
        itemData = result[0] || null;
        userId = itemData?.userId || null;
        isValid = itemData !== null && itemData.status === 'scheduled';
      } else if (job.itemType === 'task') {
        const result = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, job.itemId))
          .limit(1);
        itemData = result[0] || null;
        userId = itemData?.userId || null;
        isValid = itemData !== null && (itemData.status === 'pending' || itemData.status === 'in_progress' || itemData.status === 'overdue');
      } else if (job.itemType === 'bill_reminder') {
        const result = await db
          .select()
          .from(billReminders)
          .where(eq(billReminders.id, job.itemId))
          .limit(1);
        itemData = result[0] || null;
        userId = itemData?.userId || null;
        isValid = itemData !== null && itemData.status === 'active';
      }

      if (!isValid || !userId) {
        console.warn('[notification-jobs:process] Cancelling invalid job:', {
          jobId: job.id,
          itemType: job.itemType,
          itemId: job.itemId,
          userId,
          reason: !itemData ? 'Item not found' : 'Item status invalid'
        });
        await db
          .update(notificationJobs)
          .set({
            status: 'cancelled',
            lastError: 'Item no longer valid',
            updatedAt: new Date()
          })
          .where(eq(notificationJobs.id, job.id));
        continue;
      }

      // Log processing with user context for audit trail
      console.log('[notification-jobs:process] Processing job:', {
        jobId: job.id,
        itemType: job.itemType,
        itemId: job.itemId,
        userId,
        scheduledAt: job.scheduledAt
      });

      const sendResult = await sendNotification(job, itemData);

      if (sendResult.success) {
        await db
          .update(notificationJobs)
          .set({
            status: 'sent',
            sentAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(notificationJobs.id, job.id));
        processed++;
      } else {
        console.warn('[notification-jobs:process] Failed to send notification:', {
          jobId: job.id,
          userId,
          error: sendResult.error
        });
        failed++;

        if (job.attempts >= 3) {
          await db
            .update(notificationJobs)
            .set({
              status: 'failed',
              lastError: sendResult.error,
              updatedAt: new Date()
            })
            .where(eq(notificationJobs.id, job.id));
        } else {
          await db
            .update(notificationJobs)
            .set({
              attempts: job.attempts + 1,
              lastError: sendResult.error,
              updatedAt: new Date()
            })
            .where(eq(notificationJobs.id, job.id));
        }
      }
    } catch (error) {
      console.error('[notification-jobs:process] Failed:', error, {
        jobId: job.id,
        itemType: job.itemType,
        itemId: job.itemId
      });
      failed++;

      await db
        .update(notificationJobs)
        .set({
          attempts: job.attempts + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(notificationJobs.id, job.id));
    }
  }
  
  return { processed, failed };
}

async function sendNotification(job: NotificationJob, itemData: EventItem | TaskItem | BillReminderItem | null): Promise<{ success: boolean; error?: string }> {
  if (job.channel === 'email') {
    return await sendEmailNotification(job, itemData);
  }

  return { success: false, error: 'Unsupported channel' };
}

async function sendEmailNotification(job: NotificationJob, itemData: EventItem | TaskItem | BillReminderItem | null): Promise<{ success: boolean; error?: string }> {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    if (!itemData) {
      throw new Error('Item data not found');
    }

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, itemData.userId))
      .limit(1);

    if (!settings?.notificationEmail) {
      throw new Error('User notification email not configured');
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@northstar.app';
    const toEmail = settings.notificationEmail;
    const timeZone = settings.timezone || 'UTC';
    const locale: Locale = (settings.locale as Locale) || defaultLocale;
    
    let subject = '';
    let body = '';
    let html: string | undefined = undefined;

    if (job.itemType === 'event' && itemData && 'startAt' in itemData) {
      const eventItem = itemData as EventItem;
      const eventTime = formatDateTimeForUser(new Date(eventItem.startAt), timeZone);
      subject = `Event Reminder: ${eventItem.title}`;
      body = `You have an upcoming event: ${eventItem.title}\n\nTime: ${eventTime}\n\nView your calendar at ${process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app'}/calendar`;
    } else if (job.itemType === 'task' && itemData && 'dueAt' in itemData) {
      const taskItem = itemData as TaskItem;
      const dueDate = taskItem.dueAt
        ? formatDateTimeForUser(new Date(taskItem.dueAt), timeZone)
        : 'N/A';
      subject = `Task Reminder: ${taskItem.title}`;
      body = `You have a task due: ${taskItem.title}\n\nDue: ${dueDate}\n\nView your calendar at ${process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app'}/calendar`;
    } else if (job.itemType === 'bill_reminder' && itemData && 'dueDay' in itemData) {
      const reminderItem = itemData as BillReminderItem;
      const nextDue = calculateNextDueDate(reminderItem, { timeZone });
      const now = new Date();
      const daysUntil = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Get category if exists
      let category = null;
      if (reminderItem.categoryId) {
        const [cat] = await db
          .select()
          .from(categories)
          .where(eq(categories.id, reminderItem.categoryId))
          .limit(1);
        category = cat || null;
      }

      const emailData = {
        reminderName: reminderItem.name,
        amount: reminderItem.amount,
        categoryName: category?.name || null,
        categoryColor: category?.color || null,
        dueDate: new Intl.DateTimeFormat(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone,
        }).format(nextDue),
        dueTime: reminderItem.dueTime,
        daysUntilDue: daysUntil,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app',
        locale,
      };

      subject = translateWithLocale(locale, 'emails.billReminder.subject', { name: reminderItem.name });
      body = generateBillReminderText(emailData);
      html = generateBillReminderHtml(emailData);
    }

    const emailPayload: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    } = {
      from: fromEmail,
      to: toEmail,
      subject,
      text: body,
    };

    if (html) {
      emailPayload.html = html;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }
    
    return { success: true };
  } catch (error) {
    console.error('[notifications:email] Failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
  }
}
