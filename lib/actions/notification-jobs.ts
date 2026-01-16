'use server';

import { db } from '@/lib/db';
import { notificationJobs, events, tasks, userSettings, billReminders, categories } from '@/lib/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { generateBillReminderHtml, generateBillReminderText } from '@/lib/email/bill-reminder-template';
import { generateGroupedBillRemindersHtml, generateGroupedBillRemindersText } from '@/lib/email/bill-reminders-grouped-template';
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

  // Get all pending jobs
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

  // Separate bill reminder email jobs from others
  const billReminderEmailJobs: typeof pendingJobs = [];
  const otherJobs: typeof pendingJobs = [];

  for (const jobWrapper of pendingJobs) {
    if (jobWrapper.job.itemType === 'bill_reminder' && jobWrapper.job.channel === 'email') {
      billReminderEmailJobs.push(jobWrapper);
    } else {
      otherJobs.push(jobWrapper);
    }
  }

  // Process bill reminder email jobs with grouping
  if (billReminderEmailJobs.length > 0) {
    const groupResult = await processBillReminderEmailJobsGrouped(billReminderEmailJobs);
    processed += groupResult.processed;
    failed += groupResult.failed;
  }

  // Process other jobs individually (original logic)
  for (const { job } of otherJobs) {
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

async function processBillReminderEmailJobsGrouped(
  jobWrappers: Array<{ job: NotificationJob }>
): Promise<ProcessNotificationJobResult> {
  let processed = 0;
  let failed = 0;

  // First, fetch all reminders to get userId for grouping
  const jobsWithReminders = await Promise.all(
    jobWrappers.map(async (wrapper) => {
      const [reminder] = await db
        .select()
        .from(billReminders)
        .where(eq(billReminders.id, wrapper.job.itemId))
        .limit(1);
      return { ...wrapper, reminder };
    })
  );

  // Group jobs by userId and scheduledDate (same day)
  const groups = new Map<string, Array<{ job: NotificationJob; reminder: BillReminderItem | undefined }>>();

  for (const item of jobsWithReminders) {
    if (!item.reminder) continue; // Skip jobs without reminders

    const scheduledDate = new Date(item.job.scheduledAt);
    scheduledDate.setHours(0, 0, 0, 0);
    const dateKey = scheduledDate.toISOString().split('T')[0];
    const key = `${item.reminder.userId}:${dateKey}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  // Process each group
  for (const [groupKey, groupItems] of groups.entries()) {
    try {
      const [userId] = groupKey.split(':');

      // Filter valid reminders (already fetched)
      const validReminders: Array<{
        job: NotificationJob;
        reminder: BillReminderItem;
      }> = [];
      const invalidJobIds: number[] = [];

      for (const item of groupItems) {
        if (item.reminder && item.reminder.status === 'active') {
          validReminders.push({ job: item.job, reminder: item.reminder });
        } else {
          invalidJobIds.push(item.job.id);
        }
      }

      // Cancel invalid jobs
      if (invalidJobIds.length > 0) {
        await db
          .update(notificationJobs)
          .set({
            status: 'cancelled',
            lastError: 'Reminder no longer active',
            updatedAt: new Date()
          })
          .where(inArray(notificationJobs.id, invalidJobIds));

        console.warn('[notification-jobs:grouped] Cancelled invalid jobs:', {
          count: invalidJobIds.length,
          jobIds: invalidJobIds
        });
      }

      // Skip if no valid reminders
      if (validReminders.length === 0) {
        continue;
      }

      // Get user settings
      const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (!settings?.notificationEmail) {
        // Mark all jobs as failed
        const jobIds = validReminders.map(({ job }) => job.id);
        await db
          .update(notificationJobs)
          .set({
            status: 'failed',
            lastError: 'User notification email not configured',
            updatedAt: new Date()
          })
          .where(inArray(notificationJobs.id, jobIds));
        failed += validReminders.length;
        continue;
      }

      const timeZone = settings.timezone || 'UTC';
      const locale: Locale = (settings.locale as Locale) || defaultLocale;

      // Build reminder data array
      const reminderDataPromises = validReminders.map(async ({ reminder }) => {
        const nextDue = calculateNextDueDate(reminder, { timeZone });
        const now = new Date();
        const daysUntil = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let category = null;
        if (reminder.categoryId) {
          const [cat] = await db
            .select()
            .from(categories)
            .where(eq(categories.id, reminder.categoryId))
            .limit(1);
          category = cat || null;
        }

        return {
          reminderName: reminder.name,
          amount: reminder.amount,
          categoryName: category?.name || null,
          categoryColor: category?.color || null,
          dueDate: new Intl.DateTimeFormat(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone,
          }).format(nextDue),
          dueTime: reminder.dueTime,
          daysUntilDue: daysUntil,
        };
      });

      const reminderDataArray = await Promise.all(reminderDataPromises);

      // Determine email type and send
      const jobIds = validReminders.map(({ job }) => job.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app';
      const scheduledDate = validReminders[0].job.scheduledAt;
      const formattedDate = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      }).format(new Date(scheduledDate));

      let subject: string;
      let textBody: string;
      let htmlBody: string;

      if (validReminders.length === 1) {
        // Single reminder - use single template
        const data = {
          ...reminderDataArray[0],
          appUrl,
          locale,
        };
        subject = translateWithLocale(locale, 'emails.billReminder.subject', {
          name: validReminders[0].reminder.name
        });
        textBody = generateBillReminderText(data);
        htmlBody = generateBillReminderHtml(data);
      } else {
        // Multiple reminders - use grouped template
        const data = {
          reminders: reminderDataArray,
          scheduledDate: formattedDate,
          appUrl,
          locale,
        };
        subject = translateWithLocale(locale, 'emails.billReminders.subject', { date: formattedDate });
        textBody = generateGroupedBillRemindersText(data);
        htmlBody = generateGroupedBillRemindersHtml(data);
      }

      // Send email
      const sendResult = await sendGroupedBillReminderEmail({
        fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@northstar.app',
        toEmail: settings.notificationEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });

      const sentAt = new Date();

      if (sendResult.success) {
        // Mark all jobs as sent
        await db
          .update(notificationJobs)
          .set({
            status: 'sent',
            sentAt,
            updatedAt: new Date()
          })
          .where(inArray(notificationJobs.id, jobIds));
        processed += validReminders.length;

        console.log('[notification-jobs:grouped] Sent grouped email:', {
          userId,
          reminderCount: validReminders.length,
          jobIds
        });
      } else {
        // Increment attempts or mark as failed for all jobs
        const maxAttempts = validReminders[0].job.attempts >= 3;

        if (maxAttempts) {
          await db
            .update(notificationJobs)
            .set({
              status: 'failed',
              lastError: sendResult.error,
              updatedAt: new Date()
            })
            .where(inArray(notificationJobs.id, jobIds));
        } else {
          await db
            .update(notificationJobs)
            .set({
              attempts: validReminders[0].job.attempts + 1,
              lastError: sendResult.error,
              updatedAt: new Date()
            })
            .where(inArray(notificationJobs.id, jobIds));
        }

        failed += validReminders.length;

        console.warn('[notification-jobs:grouped] Failed to send grouped email:', {
          userId,
          reminderCount: validReminders.length,
          error: sendResult.error
        });
      }
    } catch (error) {
      console.error('[notification-jobs:grouped] Group processing failed:', error, {
        groupKey,
        jobCount: groupItems.length
      });

      // Mark all jobs in group as failed
      const jobIds = groupItems.map((item) => item.job.id);
      await db
        .update(notificationJobs)
        .set({
          attempts: groupItems[0].job.attempts + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(inArray(notificationJobs.id, jobIds));

      failed += groupItems.length;
    }
  }

  return { processed, failed };
}

async function sendGroupedBillReminderEmail(params: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.fromEmail,
        to: params.toEmail,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }

    return { success: true };
  } catch (error) {
    console.error('[notifications:grouped-email] Failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
  }
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
