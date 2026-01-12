/**
 * Natural language parser for task/event creation
 * Inspired by Todoist's smart date recognition
 *
 * Example inputs:
 * - "Dentist tomorrow at 9 for 30m p1"
 * - "Meeting friday 3pm for 2h"
 * - "Call mom next week"
 */

import * as chrono from 'chrono-node';

export interface ParsedTask {
  /** Cleaned title (patterns removed) */
  title: string;
  /** Extracted due date/time */
  dueAt?: Date;
  /** Extracted start time (when duration present) */
  startAt?: Date;
  /** Extracted duration in minutes */
  durationMinutes?: number;
  /** Extracted priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface TokenMatch {
  type: 'prefix' | 'date' | 'duration' | 'priority' | 'text';
  text: string;
  start: number;
  end: number;
  isPartial?: boolean;
  value: Date | number | string | null;
}

export interface ParsedInputWithTokens {
  tokens: TokenMatch[];
  parsed: ParsedTask;
  inferredType: 'task' | 'event';
}

interface ExtractedPattern {
  pattern: string;
  start: number;
  end: number;
}

/**
 * Duration patterns:
 * - "for 30m" / "for 30 min" / "for 30 minutes"
 * - "for 2h" / "for 2 hr" / "for 2 hours"
 */
const DURATION_REGEX = /\bfor\s+(\d+)\s*(m|min|minutes?|h|hr|hours?)\b/i;

/**
 * Priority patterns:
 * - p1 → critical
 * - p2 → high
 * - p3 → medium
 * - p4 → low
 */
const PRIORITY_REGEX = /\bp([1-4])\b/i;

const PRIORITY_MAP: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  '1': 'critical',
  '2': 'high',
  '3': 'medium',
  '4': 'low',
};

/**
 * Common date keywords for partial match detection
 */
const DATE_KEYWORDS = [
  'today', 'tomorrow', 'tonight',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'next', 'week', 'month', 'year',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Detect partial matches for tentative highlighting
 */
function findPartialMatches(text: string): TokenMatch[] {
  const partialTokens: TokenMatch[] = [];
  const words = text.split(/\s+/);
  let position = 0;

  for (const word of words) {
    const wordLower = word.toLowerCase();

    // Check for partial date keyword matches (min 3 chars)
    if (word.length >= 3) {
      const matchedKeyword = DATE_KEYWORDS.find(
        keyword => keyword.startsWith(wordLower) && keyword !== wordLower
      );

      if (matchedKeyword) {
        partialTokens.push({
          type: 'date',
          text: word,
          start: position,
          end: position + word.length,
          value: null,
          isPartial: true,
        });
      }
    }

    position += word.length + 1; // +1 for space
  }

  return partialTokens;
}

/**
 * Parse natural language input into structured task data
 *
 * @param text - The input string (e.g., "Dentist tomorrow at 9 for 30m p1")
 * @param referenceDate - Reference date for relative dates (defaults to now)
 * @returns Parsed task data with cleaned title
 */
export function parseTaskInput(
  text: string,
  referenceDate: Date = new Date()
): ParsedTask {
  const extractedPatterns: ExtractedPattern[] = [];

  // Extract duration FIRST so we can filter it out from chrono results
  let durationMinutes: number | undefined;
  const durationMatch = text.match(DURATION_REGEX);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();

    if (unit.startsWith('h')) {
      durationMinutes = value * 60;
    } else {
      durationMinutes = value;
    }

    extractedPatterns.push({
      pattern: durationMatch[0],
      start: durationMatch.index!,
      end: durationMatch.index! + durationMatch[0].length,
    });
  }

  // Extract date/time using chrono-node, filtering out duration patterns
  const chronoResults = chrono.parse(text, referenceDate, { forwardDate: true });
  let dueAt: Date | undefined;
  let startAt: Date | undefined;

  // Find first chrono result that's NOT a duration pattern
  const dateResult = chronoResults.find(result => {
    // Skip if this matches our duration pattern
    if (durationMatch && result.index === durationMatch.index) {
      return false;
    }
    return true;
  });

  if (dateResult) {
    // Store the date text for removal
    extractedPatterns.push({
      pattern: dateResult.text,
      start: dateResult.index,
      end: dateResult.index + dateResult.text.length,
    });

    dueAt = dateResult.start.date();

    // If duration is present and we have a time, adjust startAt and dueAt
    if (durationMinutes && dateResult.start.isCertain('hour')) {
      startAt = dueAt;
      dueAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    }
  }

  // Extract priority
  let priority: ParsedTask['priority'] | undefined;
  const priorityMatch = text.match(PRIORITY_REGEX);
  if (priorityMatch) {
    priority = PRIORITY_MAP[priorityMatch[1]];

    extractedPatterns.push({
      pattern: priorityMatch[0],
      start: priorityMatch.index!,
      end: priorityMatch.index! + priorityMatch[0].length,
    });
  }

  // Remove extracted patterns from title (in reverse order to preserve indices)
  let cleanedTitle = text;
  const sortedPatterns = extractedPatterns.sort((a, b) => b.start - a.start);
  for (const pattern of sortedPatterns) {
    cleanedTitle =
      cleanedTitle.slice(0, pattern.start) +
      cleanedTitle.slice(pattern.end);
  }

  // Clean up extra whitespace
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();

  return {
    title: cleanedTitle,
    dueAt,
    startAt,
    durationMinutes,
    priority,
  };
}

/**
 * Parse input with position-aware token extraction
 * Returns tokens with their positions for badge highlighting
 */
export function parseInputWithTokens(
  text: string,
  referenceDate: Date = new Date(),
  defaultType?: 'task' | 'event'
): ParsedInputWithTokens {
  const tokens: TokenMatch[] = [];
  let workingText = text;

  // 1. Extract prefix (event: or task:)
  const prefixMatch = workingText.match(/^(event|task)\s*:\s*/i);
  let explicitType: 'task' | 'event' | null = null;

  if (prefixMatch) {
    const prefixType = prefixMatch[1].toLowerCase() as 'task' | 'event';
    explicitType = prefixType;
    tokens.push({
      type: 'prefix',
      text: prefixMatch[0],
      start: 0,
      end: prefixMatch[0].length,
      value: prefixType,
      isPartial: false,
    });
    workingText = workingText.slice(prefixMatch[0].length);
  }

  // Adjust offset for removed prefix
  const prefixOffset = prefixMatch ? prefixMatch[0].length : 0;

  // 2. Extract duration
  let durationMinutes: number | undefined;
  const durationMatch = workingText.match(DURATION_REGEX);
  if (durationMatch && durationMatch.index !== undefined) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    durationMinutes = unit.startsWith('h') ? value * 60 : value;

    tokens.push({
      type: 'duration',
      text: durationMatch[0],
      start: prefixOffset + durationMatch.index,
      end: prefixOffset + durationMatch.index + durationMatch[0].length,
      value: durationMinutes,
      isPartial: false,
    });
  }

  // 3. Extract date/time using chrono
  const chronoResults = chrono.parse(workingText, referenceDate, { forwardDate: true });
  let dueAt: Date | undefined;
  let startAt: Date | undefined;

  const dateResult = chronoResults.find(result => {
    // Skip if overlaps with duration
    if (durationMatch && result.index === durationMatch.index) {
      return false;
    }
    return true;
  });

  if (dateResult) {
    dueAt = dateResult.start.date();

    // If duration present and we have time, adjust startAt/dueAt
    if (durationMinutes && dateResult.start.isCertain('hour')) {
      startAt = dueAt;
      dueAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    }

    tokens.push({
      type: 'date',
      text: dateResult.text,
      start: prefixOffset + dateResult.index,
      end: prefixOffset + dateResult.index + dateResult.text.length,
      value: dateResult.start.date(),
      isPartial: false,
    });
  }

  // 4. Extract priority
  let priority: ParsedTask['priority'] | undefined;
  const priorityMatch = workingText.match(PRIORITY_REGEX);
  if (priorityMatch && priorityMatch.index !== undefined) {
    priority = PRIORITY_MAP[priorityMatch[1]];

    tokens.push({
      type: 'priority',
      text: priorityMatch[0],
      start: prefixOffset + priorityMatch.index,
      end: prefixOffset + priorityMatch.index + priorityMatch[0].length,
      value: priority,
      isPartial: false,
    });
  }

  // 5. Build cleaned title (same logic as original)
  const extractedPatterns: ExtractedPattern[] = [];
  if (durationMatch) {
    extractedPatterns.push({
      pattern: durationMatch[0],
      start: durationMatch.index!,
      end: durationMatch.index! + durationMatch[0].length,
    });
  }
  if (dateResult) {
    extractedPatterns.push({
      pattern: dateResult.text,
      start: dateResult.index,
      end: dateResult.index + dateResult.text.length,
    });
  }
  if (priorityMatch) {
    extractedPatterns.push({
      pattern: priorityMatch[0],
      start: priorityMatch.index!,
      end: priorityMatch.index! + priorityMatch[0].length,
    });
  }

  let cleanedTitle = workingText;
  const sortedPatterns = extractedPatterns.sort((a, b) => b.start - a.start);
  for (const pattern of sortedPatterns) {
    cleanedTitle = cleanedTitle.slice(0, pattern.start) + cleanedTitle.slice(pattern.end);
  }
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();

  // 6. Infer type (event if time + duration, else task)
  let inferredType: 'task' | 'event' = defaultType || 'task';
  if (explicitType) {
    inferredType = explicitType;
  } else if (durationMinutes && dateResult?.start.isCertain('hour')) {
    // Only auto-detect to event if no defaultType provided
    if (!defaultType) inferredType = 'event';
  }

  // 7. Add partial matches for words not yet fully matched
  const partialMatches = findPartialMatches(workingText);
  for (const partial of partialMatches) {
    const start = prefixOffset + partial.start;
    const end = prefixOffset + partial.end;

    // Only add if position doesn't overlap with existing tokens
    const overlaps = tokens.some(
      t => (start >= t.start && start < t.end) ||
           (end > t.start && end <= t.end)
    );
    if (!overlaps) {
      tokens.push({
        ...partial,
        start,
        end,
      });
    }
  }

  // 8. Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);

  return {
    tokens,
    parsed: {
      title: cleanedTitle,
      dueAt,
      startAt,
      durationMinutes,
      priority,
    },
    inferredType,
  };
}
