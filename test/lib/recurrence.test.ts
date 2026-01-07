import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseRRule,
  expandOccurrences,
  getNextOccurrence,
  getAllOccurrencesBetween,
  isValidRRule,
  createSimpleRRule,
} from '@/lib/recurrence';

describe('Recurrence Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseRRule', () => {
    it('parses valid RRULE string', () => {
      const rule = parseRRule('FREQ=WEEKLY;INTERVAL=1');
      expect(rule).toBeDefined();
    });

    it('throws error for invalid RRULE', () => {
      expect(() => parseRRule('INVALID_RRULE')).toThrow('Invalid RRULE');
    });
  });

  describe('expandOccurrences', () => {
    it('expands daily recurrence', () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-01-05T23:59:59Z');
      const baseStartAt = new Date('2025-01-01T00:00:00Z');
      const baseEndAt = new Date('2025-01-01T01:00:00Z');

      const occurrences = expandOccurrences(
        'FREQ=DAILY;INTERVAL=1',
        startDate,
        endDate,
        baseStartAt,
        baseEndAt
      );

      expect(occurrences).toHaveLength(5);
      expect(occurrences[0].endAt).toBeDefined();
    });

    it('calculates duration correctly', () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-01-02T23:59:59Z');
      const baseStartAt = new Date('2025-01-01T00:00:00Z');
      const baseEndAt = new Date('2025-01-01T02:30:00Z'); // 2.5 hours

      const occurrences = expandOccurrences(
        'FREQ=DAILY;INTERVAL=1',
        startDate,
        endDate,
        baseStartAt,
        baseEndAt
      );

      const duration = occurrences[0].endAt!.getTime() - occurrences[0].startAt.getTime();
      expect(duration).toBe(2.5 * 60 * 60 * 1000); // 2.5 hours in ms
    });

    it('respects COUNT in RRULE', () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-12-31T23:59:59Z');
      const baseStartAt = new Date('2025-01-01T00:00:00Z');

      const occurrences = expandOccurrences(
        'FREQ=WEEKLY;COUNT=3',
        startDate,
        endDate,
        baseStartAt
      );

      expect(occurrences).toHaveLength(3);
    });

    it('respects UNTIL in RRULE', () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-12-31T23:59:59Z');
      const baseStartAt = new Date('2025-01-01T00:00:00Z');

      const occurrences = expandOccurrences(
        'FREQ=DAILY;UNTIL=20250110T000000Z',
        startDate,
        endDate,
        baseStartAt
      );

      expect(occurrences.length).toBeGreaterThan(0);
      expect(occurrences.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getNextOccurrence', () => {
    it('returns next occurrence after given date', () => {
      const fromDate = new Date('2025-01-01T00:00:00Z');
      const next = getNextOccurrence('FREQ=WEEKLY;INTERVAL=1', fromDate);

      expect(next).toBeDefined();
      expect(next).toBeInstanceOf(Date);
    });

    it('returns null when no more occurrences', () => {
      const fromDate = new Date('2025-01-01T00:00:00Z');
      const next = getNextOccurrence('FREQ=DAILY;COUNT=1;UNTIL=20241231T000000Z', fromDate);

      expect(next).toBeNull();
    });
  });

  describe('getAllOccurrencesBetween', () => {
    it('returns all occurrences in date range', () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-01-07T23:59:59Z');

      const occurrences = getAllOccurrencesBetween('FREQ=DAILY;INTERVAL=1', startDate, endDate);

      expect(occurrences).toHaveLength(7);
    });

    it('returns empty array for no matches', () => {
      const startDate = new Date('2025-06-01T00:00:00Z');
      const endDate = new Date('2025-06-30T23:59:59Z');

      const occurrences = getAllOccurrencesBetween(
        'FREQ=DAILY;UNTIL=20250131T000000Z',
        startDate,
        endDate
      );

      expect(occurrences).toHaveLength(0);
    });
  });

  describe('isValidRRule', () => {
    it('returns true for valid daily RRULE', () => {
      expect(isValidRRule('FREQ=DAILY;INTERVAL=1')).toBe(true);
    });

    it('returns true for valid weekly RRULE', () => {
      expect(isValidRRule('FREQ=WEEKLY;INTERVAL=2')).toBe(true);
    });

    it('returns false for invalid RRULE', () => {
      expect(isValidRRule('FREQ=INVALID')).toBe(false);
    });

    it('returns false for malformed RRULE', () => {
      expect(isValidRRule('NOT_AN_RRULE')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidRRule('')).toBe(false);
    });
  });

  describe('createSimpleRRule', () => {
    it('creates daily RRULE', () => {
      const rrule = createSimpleRRule('DAILY', 1);
      expect(rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('creates weekly RRULE', () => {
      const rrule = createSimpleRRule('WEEKLY', 2);
      expect(rrule).toBe('FREQ=WEEKLY;INTERVAL=2');
    });

    it('creates monthly RRULE', () => {
      const rrule = createSimpleRRule('MONTHLY', 1);
      expect(rrule).toBe('FREQ=MONTHLY;INTERVAL=1');
    });

    it('creates yearly RRULE', () => {
      const rrule = createSimpleRRule('YEARLY', 1);
      expect(rrule).toBe('FREQ=YEARLY;INTERVAL=1');
    });

    it('adds COUNT when provided', () => {
      const rrule = createSimpleRRule('DAILY', 1, 10);
      expect(rrule).toBe('FREQ=DAILY;INTERVAL=1;COUNT=10');
    });

    it('adds UNTIL when provided', () => {
      const untilDate = new Date('2025-12-31T23:59:59Z');
      const rrule = createSimpleRRule('DAILY', 1, undefined, untilDate);
      expect(rrule).toContain('UNTIL=');
      expect(rrule).toContain('20251231T235959Z');
    });

    it('handles COUNT and UNTIL together', () => {
      const untilDate = new Date('2025-12-31T23:59:59Z');
      const rrule = createSimpleRRule('DAILY', 1, 5, untilDate);
      expect(rrule).toContain('COUNT=5');
      expect(rrule).toContain('UNTIL=');
    });
  });
});