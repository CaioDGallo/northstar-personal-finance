import type { BillReminder } from '@/lib/schema';

/**
 * Calculate the next due date for a bill reminder based on its recurrence type
 */
export function calculateNextDueDate(reminder: BillReminder): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  switch (reminder.recurrenceType) {
    case 'once': {
      const [year, month] = reminder.startMonth.split('-').map(Number);
      const dueDate = new Date(year, month - 1, reminder.dueDay);

      if (reminder.dueTime) {
        const [hours, minutes] = reminder.dueTime.split(':').map(Number);
        dueDate.setHours(hours, minutes, 0, 0);
      }

      return dueDate;
    }

    case 'weekly': {
      // dueDay represents day of week (0-6)
      const today = now.getDay();
      const targetDay = reminder.dueDay;
      let daysUntil = targetDay - today;

      if (daysUntil <= 0) {
        daysUntil += 7;
      }

      const nextDate = new Date(now);
      nextDate.setDate(currentDay + daysUntil);

      if (reminder.dueTime) {
        const [hours, minutes] = reminder.dueTime.split(':').map(Number);
        nextDate.setHours(hours, minutes, 0, 0);
      }

      return nextDate;
    }

    case 'biweekly': {
      // Calculate from startMonth
      const [year, month] = reminder.startMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, reminder.dueDay);

      // Find next occurrence
      const nextDate = new Date(startDate);
      while (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 14);
      }

      if (reminder.dueTime) {
        const [hours, minutes] = reminder.dueTime.split(':').map(Number);
        nextDate.setHours(hours, minutes, 0, 0);
      }

      return nextDate;
    }

    case 'monthly': {
      // Calculate next occurrence of dueDay
      let nextDate = new Date(currentYear, currentMonth, reminder.dueDay);

      if (nextDate <= now) {
        nextDate = new Date(currentYear, currentMonth + 1, reminder.dueDay);
      }

      if (reminder.dueTime) {
        const [hours, minutes] = reminder.dueTime.split(':').map(Number);
        nextDate.setHours(hours, minutes, 0, 0);
      }

      return nextDate;
    }

    case 'quarterly': {
      // Calculate from startMonth
      const [startYear, startMonth] = reminder.startMonth.split('-').map(Number);
      const nextDate = new Date(startYear, startMonth - 1, reminder.dueDay);

      while (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 3);
      }

      if (reminder.dueTime) {
        const [hours, minutes] = reminder.dueTime.split(':').map(Number);
        nextDate.setHours(hours, minutes, 0, 0);
      }

      return nextDate;
    }

    case 'yearly': {
      // Calculate from startMonth
      const [, startMonth] = reminder.startMonth.split('-').map(Number);
      let nextDate = new Date(currentYear, startMonth - 1, reminder.dueDay);

      if (nextDate <= now) {
        nextDate = new Date(currentYear + 1, startMonth - 1, reminder.dueDay);
      }

      if (reminder.dueTime) {
        const [hours, minutes] = reminder.dueTime.split(':').map(Number);
        nextDate.setHours(hours, minutes, 0, 0);
      }

      return nextDate;
    }

    default:
      throw new Error(`Unsupported recurrence type: ${reminder.recurrenceType}`);
  }
}
