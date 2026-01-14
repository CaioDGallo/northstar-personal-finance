'use server';

import { db } from '@/lib/db';
import { events, tasks, userSettings, recurrenceRules } from '@/lib/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/send';
import { generateDigestHtml, generateDigestText, type DigestEvent, type DigestTask } from '@/lib/email/digest-template';
import { getAllOccurrencesBetween } from '@/lib/recurrence';
import { logError, logForDebugging } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';
import { defaultLocale, type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

export interface DigestResult {
  success: boolean;
  usersProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  errors: Array<{ userId: string; error: string }>;
}

interface UserTodayRange {
  start: Date;
  end: Date;
  localDateStr: string;
}

function getUserTodayRange(timezone: string): UserTodayRange {
  const now = new Date();

  // Format current UTC time in user's timezone to get local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const localDateStr = formatter.format(now); // "2026-01-12"

  // Parse the local date
  const [year, month, day] = localDateStr.split('-').map(Number);

  // Calculate timezone offset by comparing UTC noon with formatted time
  // This avoids parsing dates in local machine timezone
  const refUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [tzHour, tzMin] = tzFormatter.format(refUtc).split(':').map(Number);
  const offsetMs = (12 - tzHour) * 60 * 60 * 1000 - tzMin * 60 * 1000;

  // Calculate day boundaries in UTC
  const dayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + offsetMs);
  const dayEndUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + offsetMs);

  return {
    start: dayStartUTC,
    end: dayEndUTC,
    localDateStr,
  };
}

async function getTodaysEventsForUser(
  userId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<DigestEvent[]> {
  try {
    // Query events that start today (or could recur today)
    const eventsWithRecurrence = await db
      .select({
        event: events,
        recurrence: recurrenceRules,
      })
      .from(events)
      .leftJoin(
        recurrenceRules,
        and(
          eq(recurrenceRules.itemType, 'event'),
          eq(recurrenceRules.itemId, events.id)
        )
      )
      .where(
        and(
          eq(events.userId, userId),
          eq(events.status, 'scheduled'),
          // Include events that start today OR recurring events that could occur today
          lte(events.startAt, dayEnd)
        )
      );

    const digestEvents: DigestEvent[] = [];

    for (const { event, recurrence } of eventsWithRecurrence) {
      if (recurrence?.rrule) {
        // Recurring event - check if it occurs today
        try {
          const occurrences = getAllOccurrencesBetween(
            recurrence.rrule,
            dayStart,
            dayEnd,
            event.startAt
          );

          if (occurrences.length > 0) {
            // Use the first occurrence for today
            const occurrenceStart = occurrences[0];
            const duration = event.endAt.getTime() - event.startAt.getTime();
            const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

            digestEvents.push({
              id: String(event.id),
              title: event.title,
              description: event.description,
              location: event.location,
              startAt: occurrenceStart,
              endAt: occurrenceEnd,
              isAllDay: event.isAllDay,
              priority: event.priority,
            });
          }
        } catch (error) {
          logForDebugging('digest', 'Failed to expand event recurrence', {
            eventId: event.id,
            error,
          });
        }
      } else {
        // Non-recurring event - check if it starts today
        if (event.startAt >= dayStart && event.startAt < dayEnd) {
          digestEvents.push({
            id: String(event.id),
            title: event.title,
            description: event.description,
            location: event.location,
            startAt: event.startAt,
            endAt: event.endAt,
            isAllDay: event.isAllDay,
            priority: event.priority,
          });
        }
      }
    }

    // Sort by start time
    digestEvents.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return digestEvents;
  } catch (error) {
    logError(ErrorIds.DIGEST_QUERY_FAILED, 'Failed to query today\'s events', error, { userId });
    return [];
  }
}

async function getTodaysTasksForUser(
  userId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<DigestTask[]> {
  try {
    // Query tasks due today (pending or in_progress only)
    const tasksWithRecurrence = await db
      .select({
        task: tasks,
        recurrence: recurrenceRules,
      })
      .from(tasks)
      .leftJoin(
        recurrenceRules,
        and(
          eq(recurrenceRules.itemType, 'task'),
          eq(recurrenceRules.itemId, tasks.id)
        )
      )
      .where(
        and(
          eq(tasks.userId, userId),
          inArray(tasks.status, ['pending', 'in_progress']),
          // Include tasks due today OR recurring tasks that could occur today
          lte(tasks.dueAt, dayEnd)
        )
      );

    const digestTasks: DigestTask[] = [];

    for (const { task, recurrence } of tasksWithRecurrence) {
      if (recurrence?.rrule) {
        // Recurring task - check if it occurs today
        try {
          const occurrences = getAllOccurrencesBetween(
            recurrence.rrule,
            dayStart,
            dayEnd,
            task.dueAt
          );

          if (occurrences.length > 0) {
            // Use the first occurrence for today
            const occurrenceDue = occurrences[0];

            digestTasks.push({
              id: String(task.id),
              title: task.title,
              description: task.description,
              location: task.location,
              dueAt: occurrenceDue,
              priority: task.priority,
              status: task.status,
            });
          }
        } catch (error) {
          logForDebugging('digest', 'Failed to expand task recurrence', {
            taskId: task.id,
            error,
          });
        }
      } else {
        // Non-recurring task - check if it's due today
        if (task.dueAt >= dayStart && task.dueAt < dayEnd) {
          digestTasks.push({
            id: String(task.id),
            title: task.title,
            description: task.description,
            location: task.location,
            dueAt: task.dueAt,
            priority: task.priority,
            status: task.status,
          });
        }
      }
    }

    // Sort by due time
    digestTasks.sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });

    return digestTasks;
  } catch (error) {
    logError(ErrorIds.DIGEST_QUERY_FAILED, 'Failed to query today\'s tasks', error, { userId });
    return [];
  }
}

async function getOverdueTasksForUser(
  userId: string,
  beforeDate: Date
): Promise<DigestTask[]> {
  try {
    // Query overdue tasks (limited to 10)
    const overdueTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, 'overdue'),
          lte(tasks.dueAt, beforeDate)
        )
      )
      .orderBy(tasks.dueAt)
      .limit(10);

    return overdueTasks.map(task => ({
      id: String(task.id),
      title: task.title,
      description: task.description,
      location: task.location,
      dueAt: task.dueAt,
      priority: task.priority,
      status: task.status,
    }));
  } catch (error) {
    logError(ErrorIds.DIGEST_QUERY_FAILED, 'Failed to query overdue tasks', error, { userId });
    return [];
  }
}

async function sendUserDigest(
  userId: string,
  settings: typeof userSettings.$inferSelect
): Promise<boolean> {
  try {
    const timezone = settings.timezone || 'UTC';
    const locale: Locale = (settings.locale as Locale) || defaultLocale;
    const { start, end, localDateStr } = getUserTodayRange(timezone);

    logForDebugging('digest', 'Calculating digest for user', {
      userId,
      timezone,
      dayStart: start.toISOString(),
      dayEnd: end.toISOString(),
      localDate: localDateStr,
    });

    // Fetch data
    const [events, tasks, overdueTasks] = await Promise.all([
      getTodaysEventsForUser(userId, start, end),
      getTodaysTasksForUser(userId, start, end),
      getOverdueTasksForUser(userId, start),
    ]);

    // Skip if no items (empty state)
    if (events.length === 0 && tasks.length === 0 && overdueTasks.length === 0) {
      logForDebugging('digest', 'Skipping user - no items for today', { userId });
      return true; // Consider this a success (just nothing to send)
    }

    // Format date for display
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedDate = dateFormatter.format(new Date(localDateStr));

    // Generate email content
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app';
    const digestData = {
      date: formattedDate,
      events,
      tasks,
      overdueTasks,
      appUrl,
      timezone,
      locale,
    };

    const html = generateDigestHtml(digestData);
    const text = generateDigestText(digestData);

    // Send with retries
    const MAX_RETRIES = 2;
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      const result = await sendEmail({
        to: settings.notificationEmail!,
        subject: translateWithLocale(locale, 'emails.digest.subject', { date: formattedDate }),
        html,
        text,
      });

      if (result.success) {
        logForDebugging('digest', 'Successfully sent digest', {
          userId,
          events: events.length,
          tasks: tasks.length,
          overdue: overdueTasks.length,
        });
        return true;
      }

      attempts++;
      if (attempts < MAX_RETRIES) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    throw new Error('Failed to send email after retries');
  } catch (error) {
    logError(ErrorIds.DIGEST_SEND_FAILED, 'Failed to send user digest', error, { userId });
    return false;
  }
}

export async function sendAllDailyDigests(): Promise<DigestResult> {
  const result: DigestResult = {
    success: true,
    usersProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: [],
  };

  try {
    // Get all users with notifications enabled and valid email
    const users = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.notificationsEnabled, true)
        )
      );

    logForDebugging('digest', 'Starting daily digest for all users', {
      totalUsers: users.length,
    });

    for (const settings of users) {
      // Skip users without notification email
      if (!settings.notificationEmail) {
        logForDebugging('digest', 'Skipping user - no notification email', {
          userId: settings.userId,
        });
        continue;
      }

      result.usersProcessed++;

      const success = await sendUserDigest(settings.userId, settings);

      if (success) {
        result.emailsSent++;
      } else {
        result.emailsFailed++;
        result.errors.push({
          userId: settings.userId,
          error: 'Failed to send digest',
        });
      }
    }

    logForDebugging('digest', 'Completed daily digest for all users', result);

    return result;
  } catch (error) {
    logError(ErrorIds.DIGEST_SEND_FAILED, 'Failed to send daily digests', error);
    result.success = false;
    return result;
  }
}
