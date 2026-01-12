import { describe, it, expect, beforeEach } from 'vitest';
import { parseInputWithTokens, parseTaskInput } from './natural-language-parser';

describe('Natural Language Parser', () => {
  let referenceDate: Date;

  beforeEach(() => {
    // Friday, Jan 10, 2026, 10:00 AM
    referenceDate = new Date(2026, 0, 10, 10, 0, 0);
  });

  describe('Title extraction', () => {
    it('should return original text as title when no patterns found', () => {
      const result = parseTaskInput('Buy groceries', referenceDate);
      expect(result.title).toBe('Buy groceries');
      expect(result.dueAt).toBeUndefined();
      expect(result.priority).toBeUndefined();
      expect(result.durationMinutes).toBeUndefined();
    });

    it('should clean title after extracting patterns', () => {
      const result = parseTaskInput('Dentist tomorrow at 9 for 30m p1', referenceDate);
      expect(result.title).toBe('Dentist');
    });
  });

  describe('Date parsing', () => {
    it('should parse "tomorrow"', () => {
      const result = parseTaskInput('Call mom tomorrow', referenceDate);
      expect(result.title).toBe('Call mom');
      expect(result.dueAt).toBeDefined();
      // Should be Jan 11, 2026 (next day)
      expect(result.dueAt?.getDate()).toBe(11);
      expect(result.dueAt?.getMonth()).toBe(0);
      expect(result.dueAt?.getFullYear()).toBe(2026);
    });

    it('should parse "today"', () => {
      const result = parseTaskInput('Meeting today', referenceDate);
      expect(result.title).toBe('Meeting');
      expect(result.dueAt?.getDate()).toBe(10);
    });

    it('should parse "friday" (next occurrence)', () => {
      // Reference is Friday Jan 10
      // chrono parses "next friday" as Jan 16 (next week's Thursday + 1 day logic)
      const result = parseTaskInput('Dinner next friday', referenceDate);
      expect(result.title).toBe('Dinner');
      expect(result.dueAt?.getDate()).toBe(16); // Jan 16 (chrono's interpretation)
    });

    it('should parse "next week"', () => {
      const result = parseTaskInput('Project review next week', referenceDate);
      expect(result.title).toBe('Project review');
      expect(result.dueAt).toBeDefined();
      // Should be ~7 days ahead
      const daysDiff = Math.floor(
        (result.dueAt!.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeGreaterThanOrEqual(7);
    });

    it('should parse specific date "jan 15"', () => {
      const result = parseTaskInput('Appointment jan 15', referenceDate);
      expect(result.title).toBe('Appointment');
      expect(result.dueAt?.getDate()).toBe(15);
      expect(result.dueAt?.getMonth()).toBe(0);
    });
  });

  describe('Time parsing', () => {
    it('should parse "tomorrow at 9"', () => {
      const result = parseTaskInput('Dentist tomorrow at 9', referenceDate);
      expect(result.title).toBe('Dentist');
      expect(result.dueAt?.getHours()).toBe(9);
      expect(result.dueAt?.getMinutes()).toBe(0);
    });

    it('should parse "friday 3pm"', () => {
      const result = parseTaskInput('Meeting friday 3pm', referenceDate);
      expect(result.title).toBe('Meeting');
      expect(result.dueAt?.getHours()).toBe(15);
    });

    it('should parse "tomorrow at 14:30"', () => {
      // Note: "tom" as a name is ambiguous with "tomorrow"
      // Using "tomorrow" explicitly to avoid confusion
      const result = parseTaskInput('Call tomorrow at 14:30', referenceDate);
      expect(result.title).toBe('Call');
      expect(result.dueAt?.getHours()).toBe(14);
      expect(result.dueAt?.getMinutes()).toBe(30);
    });
  });

  describe('Duration parsing', () => {
    it('should parse "for 30m"', () => {
      const result = parseTaskInput('Meeting for 30m', referenceDate);
      expect(result.title).toBe('Meeting');
      expect(result.durationMinutes).toBe(30);
    });

    it('should parse "for 2h"', () => {
      const result = parseTaskInput('Workshop for 2h', referenceDate);
      expect(result.title).toBe('Workshop');
      expect(result.durationMinutes).toBe(120);
    });

    it('should parse "for 90 minutes"', () => {
      const result = parseTaskInput('Session for 90 minutes', referenceDate);
      expect(result.title).toBe('Session');
      expect(result.durationMinutes).toBe(90);
    });

    it('should parse "for 1 hour"', () => {
      const result = parseTaskInput('Call for 1 hour', referenceDate);
      expect(result.title).toBe('Call');
      expect(result.durationMinutes).toBe(60);
    });
  });

  describe('Duration with time', () => {
    it('should set startAt and dueAt when duration present with time', () => {
      const result = parseTaskInput('Meeting tomorrow at 9 for 30m', referenceDate);
      expect(result.title).toBe('Meeting');
      expect(result.startAt).toBeDefined();
      expect(result.dueAt).toBeDefined();
      expect(result.startAt?.getHours()).toBe(9);
      expect(result.durationMinutes).toBe(30);

      // dueAt should be 30 minutes after startAt
      const duration = result.dueAt!.getTime() - result.startAt!.getTime();
      expect(duration).toBe(30 * 60 * 1000);
    });

    it('should only set dueAt when duration present without time', () => {
      const result = parseTaskInput('Task tomorrow for 2h', referenceDate);
      expect(result.title).toBe('Task');
      expect(result.startAt).toBeUndefined();
      expect(result.dueAt).toBeDefined();
      expect(result.durationMinutes).toBe(120);
    });
  });

  describe('Priority parsing', () => {
    it('should parse "p1" as critical', () => {
      const result = parseTaskInput('Bug fix p1', referenceDate);
      expect(result.title).toBe('Bug fix');
      expect(result.priority).toBe('critical');
    });

    it('should parse "p2" as high', () => {
      const result = parseTaskInput('Feature p2', referenceDate);
      expect(result.title).toBe('Feature');
      expect(result.priority).toBe('high');
    });

    it('should parse "p3" as medium', () => {
      const result = parseTaskInput('Refactor p3', referenceDate);
      expect(result.title).toBe('Refactor');
      expect(result.priority).toBe('medium');
    });

    it('should parse "p4" as low', () => {
      const result = parseTaskInput('Documentation p4', referenceDate);
      expect(result.title).toBe('Documentation');
      expect(result.priority).toBe('low');
    });
  });

  describe('Combined patterns', () => {
    it('should parse Todoist-style input', () => {
      const result = parseTaskInput('Dentist appointment tomorrow at 9 for 30m p1', referenceDate);

      expect(result.title).toBe('Dentist appointment');
      expect(result.startAt).toBeDefined();
      expect(result.startAt?.getHours()).toBe(9);
      expect(result.durationMinutes).toBe(30);
      expect(result.priority).toBe('critical');
      expect(result.dueAt).toBeDefined();
    });

    it('should handle patterns in any order', () => {
      const result = parseTaskInput('p2 Meeting for 1h tomorrow at 3pm', referenceDate);

      expect(result.title).toBe('Meeting');
      expect(result.priority).toBe('high');
      expect(result.durationMinutes).toBe(60);
      expect(result.startAt?.getHours()).toBe(15);
    });

    it('should handle minimal input', () => {
      const result = parseTaskInput('Call John', referenceDate);

      expect(result.title).toBe('Call John');
      expect(result.dueAt).toBeUndefined();
      expect(result.priority).toBeUndefined();
      expect(result.durationMinutes).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = parseTaskInput('', referenceDate);
      expect(result.title).toBe('');
    });

    it('should handle only patterns (no title left)', () => {
      const result = parseTaskInput('tomorrow at 9 p1', referenceDate);
      expect(result.title).toBe('');
      expect(result.dueAt).toBeDefined();
      expect(result.priority).toBe('critical');
    });

    it('should handle multiple spaces', () => {
      const result = parseTaskInput('Meeting    tomorrow    p1', referenceDate);
      expect(result.title).toBe('Meeting');
      expect(result.dueAt).toBeDefined();
      expect(result.priority).toBe('critical');
    });

    it('should not match partial priority patterns', () => {
      const result = parseTaskInput('Phase 1 planning', referenceDate);
      // "p1" should not match inside "Phase 1" due to word boundary \b
      expect(result.title).toBe('Phase 1 planning');
      expect(result.priority).toBeUndefined();
    });

    it('should not match priority outside p1-p4 range', () => {
      const result = parseTaskInput('Meeting p5', referenceDate);
      expect(result.title).toBe('Meeting p5');
      expect(result.priority).toBeUndefined();
    });
  });

  describe('Real-world examples', () => {
    it('should parse "Dentist tomorrow at 9 for 30m"', () => {
      // Note: Using "tomorrow" explicitly instead of "tom" to avoid name ambiguity
      const result = parseTaskInput('Dentist tomorrow at 9 for 30m', referenceDate);

      expect(result.title).toBe('Dentist');
      expect(result.startAt?.getHours()).toBe(9);
      expect(result.durationMinutes).toBe(30);
    });

    it('should parse "Buy groceries today"', () => {
      const result = parseTaskInput('Buy groceries today', referenceDate);

      expect(result.title).toBe('Buy groceries');
      expect(result.dueAt?.getDate()).toBe(10); // Today
    });

    it('should parse "Team standup tomorrow 10am for 15m p2"', () => {
      const result = parseTaskInput('Team standup tomorrow 10am for 15m p2', referenceDate);

      expect(result.title).toBe('Team standup');
      expect(result.startAt?.getHours()).toBe(10);
      expect(result.durationMinutes).toBe(15);
      expect(result.priority).toBe('high');
    });

    it('should parse "Submit report friday"', () => {
      const result = parseTaskInput('Submit report friday', referenceDate);

      expect(result.title).toBe('Submit report');
      expect(result.dueAt).toBeDefined();
    });
  });

  describe('Tokenized parsing', () => {
    it('extracts prefix/date/duration/priority tokens with correct positions', () => {
      const input = 'event: Dentist tomorrow at 9 for 30m p1';
      const result = parseInputWithTokens(input, referenceDate);

      expect(result.parsed.title).toBe('Dentist');
      expect(result.inferredType).toBe('event');

      const tokenTypes = result.tokens.map(token => token.type);
      expect(tokenTypes).toEqual(['prefix', 'date', 'duration', 'priority']);

      for (const token of result.tokens) {
        expect(input.slice(token.start, token.end)).toBe(token.text);
        expect(token.isPartial).toBe(false);
      }

      const prefixToken = result.tokens[0];
      expect(prefixToken.start).toBe(0);
      expect(prefixToken.value).toBe('event');
    });

    it('adds partial date tokens when keywords are incomplete', () => {
      const input = 'task: call tom';
      const result = parseInputWithTokens(input, referenceDate);

      expect(result.inferredType).toBe('task');
      expect(result.parsed.title).toBe('call tom');

      const dateTokens = result.tokens.filter(token => token.type === 'date');
      expect(dateTokens).toHaveLength(1);
      expect(dateTokens[0].isPartial).toBe(true);
      expect(dateTokens[0].value).toBeNull();
      expect(input.slice(dateTokens[0].start, dateTokens[0].end)).toBe('tom');
    });

    it('infers event when time and duration are present', () => {
      const result = parseInputWithTokens('Review tomorrow at 9 for 30m', referenceDate);
      expect(result.inferredType).toBe('event');
      expect(result.parsed.durationMinutes).toBe(30);
      expect(result.parsed.startAt).toBeDefined();
    });

    it('respects defaultType when provided', () => {
      const result = parseInputWithTokens('Review tomorrow at 9 for 30m', referenceDate, 'task');
      expect(result.inferredType).toBe('task');
    });
  });
});
