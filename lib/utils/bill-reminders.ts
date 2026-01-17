import type { BillReminder } from '@/lib/schema';

type DueTime = { hours: number; minutes: number; seconds: number };

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type CalculateOptions = {
  now?: Date;
  timeZone?: string;
  graceWindowMs?: number;
};

const DEFAULT_DUE_TIME: DueTime = { hours: 0, minutes: 0, seconds: 0 };

const DATE_PARTS_FORMATTER_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

function parseDueTime(dueTime?: string | null): DueTime {
  if (!dueTime) return DEFAULT_DUE_TIME;
  const [hours, minutes] = dueTime.split(':').map(Number);
  return { hours, minutes, seconds: 0 };
}

function getZonedDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...DATE_PARTS_FORMATTER_OPTIONS,
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffset(timeZone: string, date: Date): number {
  const parts = getZonedDateParts(date, timeZone);
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return utcTime - date.getTime();
}

function createDateInTimeZone(
  dateParts: { year: number; month: number; day: number } & DueTime,
  timeZone: string
): Date {
  const utcDate = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      dateParts.hours,
      dateParts.minutes,
      dateParts.seconds
    )
  );
  const offset = getTimeZoneOffset(timeZone, utcDate);
  return new Date(utcDate.getTime() - offset);
}

function resolveYearMonthDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addDaysToParts(parts: { year: number; month: number; day: number }, days: number) {
  return resolveYearMonthDay(parts.year, parts.month, parts.day + days);
}

function addDaysInTimeZone(date: Date, timeZone: string, days: number): Date {
  const parts = getZonedDateParts(date, timeZone);
  const shifted = resolveYearMonthDay(parts.year, parts.month, parts.day + days);
  return createDateInTimeZone(
    {
      year: shifted.year,
      month: shifted.month,
      day: shifted.day,
      hours: parts.hour,
      minutes: parts.minute,
      seconds: parts.second,
    },
    timeZone
  );
}

function addMonthsInTimeZone(date: Date, timeZone: string, months: number): Date {
  const parts = getZonedDateParts(date, timeZone);
  const shifted = resolveYearMonthDay(parts.year, parts.month + months, parts.day);
  return createDateInTimeZone(
    {
      year: shifted.year,
      month: shifted.month,
      day: shifted.day,
      hours: parts.hour,
      minutes: parts.minute,
      seconds: parts.second,
    },
    timeZone
  );
}

export function getCurrentYearMonthInTimeZone(timeZone: string, now = new Date()): string {
  const parts = getZonedDateParts(now, timeZone);
  const month = String(parts.month).padStart(2, '0');
  return `${parts.year}-${month}`;
}

/**
 * Calculate the next due date for a bill reminder based on its recurrence type
 */
export function calculateNextDueDate(reminder: BillReminder, options: CalculateOptions = {}): Date {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone;

  if (!timeZone) {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const applyDueTime = (date: Date) => {
      if (!reminder.dueTime) return;
      const [hours, minutes] = reminder.dueTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    };

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
        const today = now.getDay();
        const targetDay = reminder.dueDay;
        let daysUntil = targetDay - today;

        if (daysUntil < 0) {
          daysUntil += 7;
        }

        if (daysUntil === 0) {
          if (reminder.dueTime) {
            const [hours, minutes] = reminder.dueTime.split(':').map(Number);
            const dueToday = new Date(now);
            dueToday.setHours(hours, minutes, 0, 0);

            if (dueToday <= now) {
              daysUntil += 7;
            }
          } else {
            daysUntil += 7;
          }
        }

        const nextDate = new Date(now);
        nextDate.setDate(currentDay + daysUntil);

        applyDueTime(nextDate);

        return nextDate;
      }

      case 'biweekly': {
        const [year, month] = reminder.startMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, reminder.dueDay);

        const nextDate = new Date(startDate);
        applyDueTime(nextDate);
        while (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 14);
        }

        return nextDate;
      }

      case 'monthly': {
        let nextDate = new Date(currentYear, currentMonth, reminder.dueDay);
        applyDueTime(nextDate);

        // If no due time is specified, consider the entire day valid
        // by comparing against end of day instead of midnight
        const compareTime = new Date(nextDate);
        if (!reminder.dueTime) {
          compareTime.setHours(23, 59, 59, 999);
        }

        const graceWindowMs = options.graceWindowMs ?? 0;
        const isWithinGraceWindow =
          nextDate < now && now.getTime() - nextDate.getTime() <= graceWindowMs;

        if (compareTime < now && !isWithinGraceWindow) {
          nextDate = new Date(currentYear, currentMonth + 1, reminder.dueDay);
          applyDueTime(nextDate);
        }

        return nextDate;
      }

      case 'quarterly': {
        const [startYear, startMonth] = reminder.startMonth.split('-').map(Number);
        const nextDate = new Date(startYear, startMonth - 1, reminder.dueDay);
        applyDueTime(nextDate);

        while (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 3);
        }

        return nextDate;
      }

      case 'yearly': {
        const [, startMonth] = reminder.startMonth.split('-').map(Number);
        let nextDate = new Date(currentYear, startMonth - 1, reminder.dueDay);
        applyDueTime(nextDate);

        if (nextDate <= now) {
          nextDate = new Date(currentYear + 1, startMonth - 1, reminder.dueDay);
          applyDueTime(nextDate);
        }

        return nextDate;
      }

      default:
        throw new Error(`Unsupported recurrence type: ${reminder.recurrenceType}`);
    }
  }

  const dueTime = parseDueTime(reminder.dueTime);
  const nowParts = getZonedDateParts(now, timeZone);
  const currentWeekday = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day)).getUTCDay();

  const buildDate = (year: number, month: number, day: number) =>
    createDateInTimeZone(
      {
        year,
        month,
        day,
        hours: dueTime.hours,
        minutes: dueTime.minutes,
        seconds: dueTime.seconds,
      },
      timeZone
    );

  switch (reminder.recurrenceType) {
    case 'once': {
      const [year, month] = reminder.startMonth.split('-').map(Number);
      return buildDate(year, month, reminder.dueDay);
    }

    case 'weekly': {
      const targetDay = reminder.dueDay;
      let daysUntil = targetDay - currentWeekday;

      if (daysUntil < 0) {
        daysUntil += 7;
      }

      if (daysUntil === 0) {
        const dueToday = buildDate(nowParts.year, nowParts.month, nowParts.day);
        if (dueToday <= now) {
          daysUntil += 7;
        }
      }

      const nextDateParts = addDaysToParts(nowParts, daysUntil);
      return buildDate(nextDateParts.year, nextDateParts.month, nextDateParts.day);
    }

    case 'biweekly': {
      const [year, month] = reminder.startMonth.split('-').map(Number);
      let nextDate = buildDate(year, month, reminder.dueDay);

      while (nextDate <= now) {
        nextDate = addDaysInTimeZone(nextDate, timeZone, 14);
      }

      return nextDate;
    }

    case 'monthly': {
      const currentMonthDate = resolveYearMonthDay(
        nowParts.year,
        nowParts.month,
        reminder.dueDay
      );
      let nextDate = buildDate(
        currentMonthDate.year,
        currentMonthDate.month,
        currentMonthDate.day
      );

      const graceWindowMs = options.graceWindowMs ?? 0;
      const isWithinGraceWindow =
        nextDate < now && now.getTime() - nextDate.getTime() <= graceWindowMs;

      if (nextDate <= now && !isWithinGraceWindow) {
        const nextMonthDate = resolveYearMonthDay(
          nowParts.year,
          nowParts.month + 1,
          reminder.dueDay
        );
        nextDate = buildDate(nextMonthDate.year, nextMonthDate.month, nextMonthDate.day);
      }

      return nextDate;
    }

    case 'quarterly': {
      const [startYear, startMonth] = reminder.startMonth.split('-').map(Number);
      let nextDate = buildDate(startYear, startMonth, reminder.dueDay);

      while (nextDate <= now) {
        nextDate = addMonthsInTimeZone(nextDate, timeZone, 3);
      }

      return nextDate;
    }

    case 'yearly': {
      const [, startMonth] = reminder.startMonth.split('-').map(Number);
      const currentYearDate = resolveYearMonthDay(nowParts.year, startMonth, reminder.dueDay);
      let nextDate = buildDate(currentYearDate.year, currentYearDate.month, currentYearDate.day);

      if (nextDate <= now) {
        nextDate = buildDate(currentYearDate.year + 1, currentYearDate.month, currentYearDate.day);
      }

      return nextDate;
    }

    default:
      throw new Error(`Unsupported recurrence type: ${reminder.recurrenceType}`);
  }
}
