import type { CalendarEvent } from '@schedule-x/calendar';
import type { BillReminder } from '@/lib/schema';
import { calculateNextDueDate } from '@/lib/utils/bill-reminders';
import { toZonedDateTime } from '@/lib/timezone-utils';

export type BillReminderScheduleEvent = CalendarEvent & {
  itemType: 'bill_reminder';
  itemId: number;
  amount?: number | null;
  categoryId?: number | null;
  status: BillReminder['status'];
};

/**
 * Generate all occurrences of a recurring bill reminder within a date range
 */
function generateOccurrences(
  reminder: BillReminder,
  viewStart: Date,
  viewEnd: Date,
  timeZone?: string
): Date[] {
  try {
    const occurrences: Date[] = [];

    // Special handling for 'once' type - just return the single date if in range
    if (reminder.recurrenceType === 'once') {
      const dueDate = calculateNextDueDate(reminder, { timeZone });
      if (dueDate >= viewStart && dueDate <= viewEnd) {
        occurrences.push(dueDate);
      }
      return occurrences;
    }

    // For recurring reminders, iterate from viewStart
    let currentCheck = new Date(viewStart);
    let safetyCounter = 0;
    const MAX_ITERATIONS = 365; // Safety limit

    while (currentCheck <= viewEnd && safetyCounter < MAX_ITERATIONS) {
      safetyCounter++;

      const nextDue = calculateNextDueDate(reminder, {
        now: currentCheck,
        timeZone,
      });

      if (nextDue > viewEnd) {
        break;
      }

      if (nextDue >= viewStart) {
        occurrences.push(nextDue);
      }

      // Move current check forward based on recurrence type
      currentCheck = new Date(nextDue.getTime() + 1000); // 1 second after to avoid infinite loops

      // Additional safety: skip ahead more aggressively
      switch (reminder.recurrenceType) {
        case 'weekly':
          currentCheck = new Date(nextDue.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'biweekly':
          currentCheck = new Date(nextDue.getTime() + 14 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          currentCheck = new Date(nextDue.getTime() + 28 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          currentCheck = new Date(nextDue.getTime() + 90 * 24 * 60 * 60 * 1000);
          break;
        case 'yearly':
          currentCheck = new Date(nextDue.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          console.error(
            `[bill-reminders:schedule] Unsupported recurrence type: ${reminder.recurrenceType} (reminder ${reminder.id})`
          );
          currentCheck = new Date(nextDue.getTime() + 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Remove duplicates (can happen with edge cases)
    const uniqueOccurrences = Array.from(
      new Set(occurrences.map(d => d.getTime()))
    ).map(t => new Date(t));

    return uniqueOccurrences;
  } catch (error) {
    console.error(`[bill-reminders:schedule] Failed for reminder ${reminder.id}:`, error);
    return [];
  }
}

export function buildBillReminderSchedule(
  reminders: BillReminder[],
  timeZone: string,
  viewStart: Date,
  viewEnd: Date
): { scheduleEvents: BillReminderScheduleEvent[] } {
  const buildScheduleEvent = (
    reminder: BillReminder,
    dueDate: Date,
    occurrenceIndex: number
  ): BillReminderScheduleEvent => {
    // Bill reminders are typically all-day events or short 1-hour events
    // If dueTime is specified, use it; otherwise make it all-day
    const startDate = new Date(dueDate);
    const endDate = new Date(dueDate);

    if (!reminder.dueTime) {
      // All-day event: set to midnight
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Timed event: 1-hour duration
      endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
    }

    const id = occurrenceIndex === 0
      ? `bill-reminder-${reminder.id}`
      : `bill-reminder-${reminder.id}-occ-${dueDate.getTime()}`;

    return {
      id,
      title: reminder.name,
      start: toZonedDateTime(startDate, timeZone),
      end: toZonedDateTime(endDate, timeZone),
      calendarId: 'bill-reminders',
      amount: reminder.amount,
      categoryId: reminder.categoryId,
      status: reminder.status,
      itemType: 'bill_reminder',
      itemId: reminder.id,
    };
  };

  const scheduleEvents = reminders.flatMap((reminder) => {
    const occurrences = generateOccurrences(reminder, viewStart, viewEnd, timeZone);

    if (occurrences.length === 0) {
      return [];
    }

    return occurrences.map((dueDate, index) =>
      buildScheduleEvent(reminder, dueDate, index)
    );
  });

  return { scheduleEvents };
}
