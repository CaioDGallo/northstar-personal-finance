import { rrulestr, RRule } from 'rrule';

export interface RecurrenceOccurrence {
  id: number;
  itemType: 'event' | 'task';
  itemId: number;
  startAt: Date;
  endAt?: Date;
  dueAt?: Date;
}

export function parseRRule(rruleString: string): RRule {
  try {
    return rrulestr(rruleString);
  } catch (error) {
    throw new Error(`Invalid RRULE: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function expandOccurrences(
  rruleString: string,
  startDate: Date,
  endDate: Date,
  baseStartAt: Date,
  baseEndAt?: Date,
  baseDueAt?: Date,
  durationMinutes?: number
): RecurrenceOccurrence[] {
  const rule = parseRRule(rruleString);
  const occurrences = rule.between(startDate, endDate, true);
  
  return occurrences.map((date, index) => {
    const startAt = new Date(date);
    let endAt: Date | undefined;
    let dueAt: Date | undefined;
    
    if (baseEndAt) {
      const baseDuration = baseEndAt.getTime() - baseStartAt.getTime();
      endAt = new Date(startAt.getTime() + baseDuration);
    }
    
    if (baseDueAt) {
      dueAt = new Date(baseDueAt.getTime() + (startAt.getTime() - baseStartAt.getTime()));
    } else if (durationMinutes) {
      dueAt = new Date(startAt.getTime() + durationMinutes * 60000);
    }
    
    return {
      id: index,
      itemType: 'event',
      itemId: index,
      startAt,
      endAt,
      dueAt,
    };
  });
}

export function getNextOccurrence(rruleString: string, fromDate: Date): Date | null {
  const rule = parseRRule(rruleString);
  
  try {
    const next = rule.after(fromDate);
    return next || null;
  } catch {
    return null;
  }
}

export function getAllOccurrencesBetween(
  rruleString: string,
  startDate: Date,
  endDate: Date
): Date[] {
  const rule = parseRRule(rruleString);
  return rule.between(startDate, endDate, true);
}

export function isValidRRule(rruleString: string): boolean {
  try {
    rrulestr(rruleString);
    return true;
  } catch {
    return false;
  }
}

export function createSimpleRRule(
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  interval: number = 1,
  count?: number,
  until?: Date
): string {
  const parts: string[] = [`FREQ=${frequency}`, `INTERVAL=${interval}`];
  
  if (count) {
    parts.push(`COUNT=${count}`);
  }
  
  if (until) {
    parts.push(`UNTIL=${until.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
  }
  
  return parts.join(';');
}
