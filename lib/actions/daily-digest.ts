'use server';

import { Temporal } from 'temporal-polyfill';
import { db } from '@/lib/db';
import { events, tasks, userSettings } from '@/lib/schema';
import { eq, and, gte, lte, or } from 'drizzle-orm';

type Event = typeof events.$inferSelect;
type Task = typeof tasks.$inferSelect;
type UserSettings = typeof userSettings.$inferSelect;

interface DailyDigestResult {
  sent: number;
  failed: number;
  skipped: number;
}

// Priority colors matching the app's oklch theme (converted to hex for email compatibility)
const PRIORITY_COLORS = {
  critical: '#dc2626', // danger red
  high: '#f97316', // orange
  medium: '#3b82f6', // info blue
  low: '#6b7280', // muted gray
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6', // blue
  pending: '#eab308', // yellow
  in_progress: '#3b82f6', // blue
  overdue: '#dc2626', // red
  completed: '#22c55e', // green
  cancelled: '#6b7280', // gray
};

function formatTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

function formatDateHeader(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function generateEmailHtml(
  settings: UserSettings,
  todayEvents: Event[],
  todayTasks: Task[],
  dateStr: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app';

  // Build events section
  let eventsSection = '';
  if (todayEvents.length > 0) {
    const eventRows = todayEvents
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map((event) => {
        const startTime = formatTime(new Date(event.startAt), settings.timezone || 'UTC');
        const endTime = formatTime(new Date(event.endAt), settings.timezone || 'UTC');
        const timeDisplay = event.isAllDay ? 'All Day' : `${startTime} - ${endTime}`;
        const priorityColor = PRIORITY_COLORS[event.priority];

        return `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${priorityColor}; margin-right: 8px;"></span>
                    <span style="font-weight: 600; color: #1a1a1a; font-size: 15px;">${escapeHtml(event.title)}</span>
                  </td>
                  <td style="text-align: right; color: #6b7280; font-size: 14px; white-space: nowrap;">
                    ${timeDisplay}
                  </td>
                </tr>
                ${event.location ? `
                <tr>
                  <td colspan="2" style="padding-top: 4px; color: #6b7280; font-size: 13px;">
                    📍 ${escapeHtml(event.location)}
                  </td>
                </tr>
                ` : ''}
                ${event.description ? `
                <tr>
                  <td colspan="2" style="padding-top: 4px; color: #6b7280; font-size: 13px;">
                    ${escapeHtml(event.description).substring(0, 100)}${event.description.length > 100 ? '...' : ''}
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        `;
      })
      .join('');

    eventsSection = `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background-color: #f8fafc; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
              📅 Events (${todayEvents.length})
            </h2>
          </td>
        </tr>
        <tr>
          <td style="background-color: #ffffff; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${eventRows}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // Build tasks section
  let tasksSection = '';
  if (todayTasks.length > 0) {
    const taskRows = todayTasks
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .map((task) => {
        const dueTime = formatTime(new Date(task.dueAt), settings.timezone || 'UTC');
        const priorityColor = PRIORITY_COLORS[task.priority];
        const statusColor = STATUS_COLORS[task.status] || '#6b7280';
        const statusLabel = task.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

        return `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${priorityColor}; margin-right: 8px;"></span>
                    <span style="font-weight: 600; color: #1a1a1a; font-size: 15px;">${escapeHtml(task.title)}</span>
                    <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; font-size: 11px; font-weight: 500; border-radius: 9999px; background-color: ${statusColor}20; color: ${statusColor};">${statusLabel}</span>
                  </td>
                  <td style="text-align: right; color: #6b7280; font-size: 14px; white-space: nowrap;">
                    Due ${dueTime}
                  </td>
                </tr>
                ${task.location ? `
                <tr>
                  <td colspan="2" style="padding-top: 4px; color: #6b7280; font-size: 13px;">
                    📍 ${escapeHtml(task.location)}
                  </td>
                </tr>
                ` : ''}
                ${task.description ? `
                <tr>
                  <td colspan="2" style="padding-top: 4px; color: #6b7280; font-size: 13px;">
                    ${escapeHtml(task.description).substring(0, 100)}${task.description.length > 100 ? '...' : ''}
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        `;
      })
      .join('');

    tasksSection = `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background-color: #f8fafc; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
              ✅ Tasks (${todayTasks.length})
            </h2>
          </td>
        </tr>
        <tr>
          <td style="background-color: #ffffff; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${taskRows}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // Empty state
  const emptyMessage =
    todayEvents.length === 0 && todayTasks.length === 0
      ? `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 32px; text-align: center; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #6b7280; font-size: 15px;">
                🎉 Your day is clear! No events or tasks scheduled.
              </p>
            </td>
          </tr>
        </table>
      `
      : '';

  // Priority legend
  const priorityLegend = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px;">
      <tr>
        <td style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px;">
          <span style="font-size: 12px; color: #6b7280;">Priority: </span>
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${PRIORITY_COLORS.critical}; margin: 0 4px 0 8px;"></span>
          <span style="font-size: 12px; color: #6b7280;">Critical</span>
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${PRIORITY_COLORS.high}; margin: 0 4px 0 12px;"></span>
          <span style="font-size: 12px; color: #6b7280;">High</span>
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${PRIORITY_COLORS.medium}; margin: 0 4px 0 12px;"></span>
          <span style="font-size: 12px; color: #6b7280;">Medium</span>
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${PRIORITY_COLORS.low}; margin: 0 4px 0 12px;"></span>
          <span style="font-size: 12px; color: #6b7280;">Low</span>
        </td>
      </tr>
    </table>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Daily Digest - ${dateStr}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f0f0;">
    <tr>
      <td style="padding: 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 24px 16px; background-color: #1a1a1a; border-radius: 8px 8px 0 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
                      ⭐ Northstar
                    </h1>
                    <p style="margin: 8px 0 0; font-size: 14px; color: #9ca3af;">
                      Your daily digest
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Date banner -->
          <tr>
            <td style="padding: 16px 24px; background-color: #ffffff; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
                ${dateStr}
              </h2>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 24px; background-color: #ffffff; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
              ${eventsSection}
              ${tasksSection}
              ${emptyMessage}
              ${priorityLegend}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 24px 24px; background-color: #ffffff; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="${appUrl}/calendar" style="display: inline-block; padding: 12px 32px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 6px;">
                      View Calendar
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f8fafc; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">
                      This is your daily digest from <a href="${appUrl}" style="color: #1a1a1a; text-decoration: none;">Northstar</a>.
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">
                      You can manage your notification preferences in <a href="${appUrl}/settings" style="color: #6b7280;">Settings</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generatePlainTextEmail(
  settings: UserSettings,
  todayEvents: Event[],
  todayTasks: Task[],
  dateStr: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://northstar.app';
  const lines: string[] = [];

  lines.push(`NORTHSTAR - Daily Digest`);
  lines.push(`========================`);
  lines.push(``);
  lines.push(dateStr);
  lines.push(``);

  if (todayEvents.length > 0) {
    lines.push(`EVENTS (${todayEvents.length})`);
    lines.push(`------`);
    for (const event of todayEvents.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )) {
      const startTime = formatTime(new Date(event.startAt), settings.timezone || 'UTC');
      const endTime = formatTime(new Date(event.endAt), settings.timezone || 'UTC');
      const timeDisplay = event.isAllDay ? 'All Day' : `${startTime} - ${endTime}`;
      lines.push(`• [${event.priority.toUpperCase()}] ${event.title}`);
      lines.push(`  Time: ${timeDisplay}`);
      if (event.location) lines.push(`  Location: ${event.location}`);
      if (event.description) lines.push(`  ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}`);
      lines.push(``);
    }
  }

  if (todayTasks.length > 0) {
    lines.push(`TASKS (${todayTasks.length})`);
    lines.push(`-----`);
    for (const task of todayTasks.sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    )) {
      const dueTime = formatTime(new Date(task.dueAt), settings.timezone || 'UTC');
      const statusLabel = task.status.replace('_', ' ').toUpperCase();
      lines.push(`• [${task.priority.toUpperCase()}] ${task.title} (${statusLabel})`);
      lines.push(`  Due: ${dueTime}`);
      if (task.location) lines.push(`  Location: ${task.location}`);
      if (task.description) lines.push(`  ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
      lines.push(``);
    }
  }

  if (todayEvents.length === 0 && todayTasks.length === 0) {
    lines.push(`Your day is clear! No events or tasks scheduled.`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`View your calendar: ${appUrl}/calendar`);
  lines.push(`Manage settings: ${appUrl}/settings`);

  return lines.join('\n');
}

async function sendDailyDigestEmail(
  settings: UserSettings,
  todayEvents: Event[],
  todayTasks: Task[],
  dateStr: string
): Promise<{ success: boolean; error?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  if (!settings.notificationEmail) {
    return { success: false, error: 'User notification email not configured' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@northstar.app';
  const toEmail = settings.notificationEmail;

  const subject = `Daily Digest: ${dateStr}`;
  const htmlBody = generateEmailHtml(settings, todayEvents, todayTasks, dateStr);
  const textBody = generatePlainTextEmail(settings, todayEvents, todayTasks, dateStr);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('[daily-digest:send] Failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getStartAndEndOfDay(date: Date, timeZone: string): { start: Date; end: Date } {
  // Convert the current date to a ZonedDateTime in the user's timezone
  const instant = Temporal.Instant.from(date.toISOString());
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);

  // Get start of day (00:00:00.000) in user's timezone
  const startOfDay = zonedDateTime.startOfDay();

  // Get end of day (23:59:59.999) in user's timezone
  const endOfDay = startOfDay.add({ hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });

  // Convert back to Date objects (UTC-based)
  return {
    start: new Date(startOfDay.epochMilliseconds),
    end: new Date(endOfDay.epochMilliseconds),
  };
}

export async function processDailyDigests(): Promise<DailyDigestResult> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Fetch all users with daily digest enabled and valid email
    const usersWithDigest = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.dailyDigestEnabled, true),
          eq(userSettings.notificationsEnabled, true)
        )
      );

    console.log(`[daily-digest:process] Found ${usersWithDigest.length} users with digest enabled`);

    for (const settings of usersWithDigest) {
      // Skip if no notification email
      if (!settings.notificationEmail) {
        console.log(`[daily-digest:process] Skipping user ${settings.userId}: no email configured`);
        skipped++;
        continue;
      }

      const timeZone = settings.timezone || 'UTC';
      const now = new Date();
      const { start: dayStart, end: dayEnd } = getStartAndEndOfDay(now, timeZone);
      const dateStr = formatDateHeader(now, timeZone);

      console.log(`[daily-digest:process] Processing user ${settings.userId}:`, {
        timeZone,
        dayStart: dayStart.toISOString(),
        dayEnd: dayEnd.toISOString(),
      });

      // Fetch today's events for this user
      const todayEvents = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.userId, settings.userId),
            eq(events.status, 'scheduled'),
            // Event starts within today
            gte(events.startAt, dayStart),
            lte(events.startAt, dayEnd)
          )
        );

      // Fetch today's tasks for this user
      const todayTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, settings.userId),
            or(
              eq(tasks.status, 'pending'),
              eq(tasks.status, 'in_progress'),
              eq(tasks.status, 'overdue')
            ),
            // Task is due within today
            gte(tasks.dueAt, dayStart),
            lte(tasks.dueAt, dayEnd)
          )
        );

      console.log(`[daily-digest:process] User ${settings.userId}: ${todayEvents.length} events, ${todayTasks.length} tasks`);

      // Send the digest (even if empty - user opted in)
      const result = await sendDailyDigestEmail(settings, todayEvents, todayTasks, dateStr);

      if (result.success) {
        console.log(`[daily-digest:process] Sent digest to ${settings.notificationEmail}`);
        sent++;
      } else {
        console.error(`[daily-digest:process] Failed to send to ${settings.notificationEmail}:`, result.error);
        failed++;
      }
    }
  } catch (error) {
    console.error('[daily-digest:process] Error:', error);
    throw error;
  }

  return { sent, failed, skipped };
}
