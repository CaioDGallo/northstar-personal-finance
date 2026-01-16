import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, getCurrentYearMonthInTimeZone } from '@/lib/utils/bill-reminders';
import type { BillReminder } from '@/lib/schema';

// Helper to create minimal BillReminder objects for testing
function createReminder(
  recurrenceType: BillReminder['recurrenceType'],
  dueDay: number,
  startMonth: string,
  dueTime?: string
): BillReminder {
  return {
    id: 'test-id',
    userId: 'test-user',
    title: 'Test Reminder',
    amountCents: 10000,
    accountId: 'test-account',
    categoryId: 'test-category',
    recurrenceType,
    dueDay,
    startMonth,
    dueTime: dueTime ?? null,
    notifyTwoDaysBefore: true,
    notifyOneDayBefore: true,
    notifyOnDueDay: true,
    isPaused: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as BillReminder;
}

describe('calculateNextDueDate - without timezone', () => {
  describe('once recurrence', () => {
    it('should return exact date for one-time reminder', () => {
      const reminder = createReminder('once', 15, '2026-03-01');
      const now = new Date('2026-01-10T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2); // March (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should include dueTime when specified', () => {
      const reminder = createReminder('once', 15, '2026-03-01', '14:30');
      const now = new Date('2026-01-10T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('weekly recurrence', () => {
    it('should return next occurrence of weekday', () => {
      // Tuesday Jan 13, 2026
      const now = new Date('2026-01-13T10:00:00Z');
      // dueDay 3 = Wednesday
      const reminder = createReminder('weekly', 3, '2026-01-01');

      const result = calculateNextDueDate(reminder, { now });

      // Should be Wednesday Jan 14
      expect(result.getDate()).toBe(14);
      expect(result.getDay()).toBe(3); // Wednesday
    });

    it('should return next week if today is the due day and time passed', () => {
      // Wednesday Jan 14, 2026 at 10:00 local time
      const now = new Date(2026, 0, 14, 15, 0, 0); // Jan 14, 3 PM local
      // dueDay 3 = Wednesday, dueTime 14:00 (2 PM local) - time already passed
      const reminder = createReminder('weekly', 3, '2026-01-01', '14:00');

      const result = calculateNextDueDate(reminder, { now });

      // Should be next Wednesday Jan 21
      expect(result.getDate()).toBe(21);
      expect(result.getDay()).toBe(3);
    });

    it('should return today if due day is today and time not passed', () => {
      // Wednesday Jan 14, 2026 at 10:00 AM local
      const now = new Date(2026, 0, 14, 10, 0, 0);
      // dueDay 3 = Wednesday, dueTime 14:00 (2 PM local) - time not yet passed
      const reminder = createReminder('weekly', 3, '2026-01-01', '14:00');

      const result = calculateNextDueDate(reminder, { now });

      // Should be today at 14:00
      expect(result.getDate()).toBe(14);
      expect(result.getHours()).toBe(14);
    });
  });

  describe('biweekly recurrence', () => {
    it('should return next occurrence 14 days from start', () => {
      const reminder = createReminder('biweekly', 1, '2026-01-01'); // Jan 1 start
      const now = new Date('2026-01-10T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Should be Jan 15 (14 days after Jan 1)
      expect(result.getDate()).toBe(15);
    });

    it('should skip to next cycle if current cycle passed', () => {
      const reminder = createReminder('biweekly', 1, '2026-01-01');
      const now = new Date('2026-01-20T10:00:00Z'); // Past Jan 15

      const result = calculateNextDueDate(reminder, { now });

      // Should be Jan 29 (14 days after Jan 15)
      expect(result.getDate()).toBe(29);
    });
  });

  describe('monthly recurrence', () => {
    it('should return same day next month if current day passed', () => {
      const reminder = createReminder('monthly', 15, '2026-01-01');
      const now = new Date('2026-01-20T10:00:00Z'); // Jan 20

      const result = calculateNextDueDate(reminder, { now });

      // Should be Feb 15
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(15);
    });

    it('should return current month if due day not passed', () => {
      const reminder = createReminder('monthly', 20, '2026-01-01');
      const now = new Date('2026-01-15T10:00:00Z'); // Jan 15

      const result = calculateNextDueDate(reminder, { now });

      // Should be Jan 20
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(20);
    });

    it('should handle day 31 on months with 30 days', () => {
      const reminder = createReminder('monthly', 31, '2026-01-01');
      const now = new Date('2026-01-15T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Jan 31 exists, should be Jan 31
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(31);

      // Calculate next after Jan 31
      const nowFeb = new Date('2026-02-01T10:00:00Z');
      const resultFeb = calculateNextDueDate(reminder, { now: nowFeb });

      // Feb only has 28 days in 2026, should roll to Mar 3
      expect(resultFeb.getMonth()).toBe(2); // March
      expect(resultFeb.getDate()).toBe(3);
    });

    it('should handle February 29 on non-leap year', () => {
      const reminder = createReminder('monthly', 29, '2026-01-01');
      const now = new Date('2026-02-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Feb 29 doesn't exist in 2026, should roll to Mar 1
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(1);
    });

    it('should handle February 29 on leap year', () => {
      const reminder = createReminder('monthly', 29, '2024-01-01');
      const now = new Date('2024-02-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Feb 29 exists in 2024 (leap year)
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(29);
    });
  });

  describe('quarterly recurrence', () => {
    it('should return next occurrence 3 months from start', () => {
      const reminder = createReminder('quarterly', 15, '2026-01-01');
      const now = new Date('2026-01-10T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Should be Jan 15 (first occurrence)
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);

      // Calculate next after Jan 15
      const nowFeb = new Date('2026-01-20T10:00:00Z');
      const resultFeb = calculateNextDueDate(reminder, { now: nowFeb });

      // Should be Apr 15 (3 months later)
      expect(resultFeb.getMonth()).toBe(3); // April
      expect(resultFeb.getDate()).toBe(15);
    });

    it('should handle day 31 across quarters', () => {
      const reminder = createReminder('quarterly', 31, '2026-01-01');
      const now = new Date('2026-02-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Should be Apr 31, which rolls to May 1
      expect(result.getMonth()).toBe(4); // May
      expect(result.getDate()).toBe(1);
    });
  });

  describe('yearly recurrence', () => {
    it('should return same date next year if current date passed', () => {
      const reminder = createReminder('yearly', 15, '2026-03-01'); // March 15
      const now = new Date('2026-04-01T10:00:00Z'); // April 1

      const result = calculateNextDueDate(reminder, { now });

      // Should be March 15, 2027
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(15);
    });

    it('should return current year if due date not passed', () => {
      const reminder = createReminder('yearly', 15, '2026-03-01');
      const now = new Date('2026-02-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // Should be March 15, 2026
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(15);
    });

    it('should handle February 29 on leap year transition', () => {
      const reminder = createReminder('yearly', 29, '2024-02-01'); // Feb 29 on leap year
      const now = new Date('2025-01-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now });

      // 2025 is not a leap year, should roll to Mar 1
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(1);
    });
  });
});

describe('calculateNextDueDate - with timezone (America/Sao_Paulo)', () => {
  const timeZone = 'America/Sao_Paulo';

  describe('once recurrence', () => {
    it('should return exact date in timezone', () => {
      const reminder = createReminder('once', 15, '2026-03-01', '14:30');
      const now = new Date('2026-01-10T12:00:00Z');

      const result = calculateNextDueDate(reminder, { now, timeZone });

      // Should be March 15, 2026 at 14:30 America/Sao_Paulo
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const formatted = formatter.format(result);
      expect(formatted).toContain('03/15/2026');
      expect(formatted).toContain('14:30');
    });
  });

  describe('weekly recurrence', () => {
    it('should calculate next weekday in timezone', () => {
      // Tuesday Jan 13, 2026 10:00 UTC
      const now = new Date('2026-01-13T10:00:00Z');
      // dueDay 3 = Wednesday
      const reminder = createReminder('weekly', 3, '2026-01-01');

      const result = calculateNextDueDate(reminder, { now, timeZone });

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      });

      const formatted = formatter.format(result);
      expect(formatted).toContain('Wed');
      expect(formatted).toContain('01/14/2026');
    });
  });

  describe('monthly recurrence', () => {
    it('should handle day 31 on short months in timezone', () => {
      const reminder = createReminder('monthly', 31, '2026-01-01', '14:00');
      const now = new Date('2026-02-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now, timeZone });

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const formatted = formatter.format(result);
      // Feb 2026 has 28 days, should roll to Mar 3
      expect(formatted).toContain('03/');
      expect(formatted).toContain('2026');
    });

    it('should handle DST transition correctly', () => {
      // DST typically happens in March/November in Brazil
      // Test around March when clocks move forward
      const reminder = createReminder('monthly', 15, '2026-01-01', '02:00');
      const now = new Date('2026-02-10T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now, timeZone });

      // Should still be Feb 15 at 02:00 (even during DST)
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const formatted = formatter.format(result);
      expect(formatted).toContain('02/15/2026');
    });
  });

  describe('quarterly recurrence', () => {
    it('should add 3 months correctly in timezone', () => {
      const reminder = createReminder('quarterly', 15, '2026-01-01', '10:00');
      const now = new Date('2026-02-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now, timeZone });

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const formatted = formatter.format(result);
      expect(formatted).toContain('04/15/2026');
    });
  });

  describe('yearly recurrence', () => {
    it('should add 1 year correctly in timezone', () => {
      const reminder = createReminder('yearly', 15, '2026-03-01', '14:00');
      const now = new Date('2026-04-01T10:00:00Z');

      const result = calculateNextDueDate(reminder, { now, timeZone });

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const formatted = formatter.format(result);
      expect(formatted).toContain('03/15/2027');
    });
  });
});

describe('getCurrentYearMonthInTimeZone', () => {
  it('should return current year-month in timezone', () => {
    const now = new Date('2026-01-15T23:00:00Z'); // 11 PM UTC
    const timeZone = 'America/Sao_Paulo'; // UTC-3

    const result = getCurrentYearMonthInTimeZone(timeZone, now);

    // In São Paulo, it's still Jan 15
    expect(result).toBe('2026-01');
  });

  it('should handle date boundary correctly', () => {
    const now = new Date('2026-02-01T02:00:00Z'); // 2 AM UTC on Feb 1
    const timeZone = 'America/Sao_Paulo'; // UTC-3

    const result = getCurrentYearMonthInTimeZone(timeZone, now);

    // In São Paulo, it's still Jan 31 at 11 PM
    expect(result).toBe('2026-01');
  });

  it('should handle UTC correctly', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const timeZone = 'UTC';

    const result = getCurrentYearMonthInTimeZone(timeZone, now);

    expect(result).toBe('2026-01');
  });
});

describe('edge cases and error handling', () => {
  it('should throw error for unsupported recurrence type', () => {
    const reminder = createReminder('monthly', 15, '2026-01-01');
    // @ts-expect-error - testing invalid recurrence type
    reminder.recurrenceType = 'invalid';

    const now = new Date('2026-01-10T10:00:00Z');

    expect(() => calculateNextDueDate(reminder, { now })).toThrow('Unsupported recurrence type');
  });

  it('should handle month boundaries correctly', () => {
    const reminder = createReminder('monthly', 1, '2026-01-01'); // First of month
    const now = new Date('2026-01-31T23:59:00Z'); // Last moment of Jan

    const result = calculateNextDueDate(reminder, { now });

    // Should be Feb 1
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(1);
  });

  it('should handle biweekly spanning multiple months', () => {
    const reminder = createReminder('biweekly', 20, '2026-01-20'); // Jan 20 start
    const now = new Date('2026-02-15T10:00:00Z');

    const result = calculateNextDueDate(reminder, { now });

    // Should calculate correctly across month boundaries
    expect(result.getMonth()).toBe(1); // February
  });

  it('should handle weekly across year boundary', () => {
    const reminder = createReminder('weekly', 1, '2025-12-01'); // Monday
    const now = new Date('2025-12-29T10:00:00Z'); // Monday Dec 29

    const result = calculateNextDueDate(reminder, { now });

    // Should be next Monday Jan 5, 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(5);
  });
});
