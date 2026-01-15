import type { CalendarEvent } from '@schedule-x/calendar';
import type { Task } from '@/lib/schema';
import { parseRRule } from '@/lib/recurrence';
import { resolveTaskRange } from '@/lib/tasks-utils';
import { toZonedDateTime } from '@/lib/timezone-utils';
import { addMonthsToDate } from '@/lib/utils';
import { logError } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

export type TaskWithRecurrence = Task & { recurrenceRule?: string | null };

export type TaskScheduleEvent = CalendarEvent & {
  itemType: 'task';
  itemId: number;
  description?: string;
  location?: string;
  priority: Task['priority'];
  status: Task['status'];
};

function resolveRecurrenceWindow(rule: ReturnType<typeof parseRRule>, baseStartAt: Date) {
  const now = new Date();
  const lookBack = addMonthsToDate(now, -1);

  if (rule.options.until || rule.options.count) {
    const rangeStart = baseStartAt;
    let rangeEnd = baseStartAt;

    if (rule.options.until) {
      rangeEnd = new Date(rule.options.until);
    } else if (rule.options.count) {
      const all = rule.all();
      rangeEnd = all[all.length - 1] ?? baseStartAt;
    }

    if (rangeEnd < rangeStart) {
      rangeEnd = rangeStart;
    }

    return { rangeStart, rangeEnd };
  }

  const anchor = baseStartAt > now ? baseStartAt : now;
  const rangeStart = baseStartAt > now ? baseStartAt : lookBack;
  const rangeEnd = addMonthsToDate(anchor, 6);

  return { rangeStart, rangeEnd };
}

export function buildTaskSchedule(tasks: TaskWithRecurrence[], timeZone: string) {
  const occurrenceOverrides = new Map<string, { startAt: Date; endAt: Date }>();

  const buildScheduleEvent = (
    task: TaskWithRecurrence,
    id: string,
    startAt: Date,
    endAt: Date
  ): TaskScheduleEvent => {
    occurrenceOverrides.set(id, { startAt, endAt });
    return {
      id,
      title: task.title,
      start: toZonedDateTime(startAt, timeZone),
      end: toZonedDateTime(endAt, timeZone),
      calendarId: 'tasks',
      description: task.description || undefined,
      location: task.location || undefined,
      priority: task.priority,
      status: task.status,
      itemType: 'task',
      itemId: task.id,
    };
  };

  const scheduleEvents = tasks.flatMap((task) => {
    const { startAt: baseStartAt, endAt: baseEndAt } = resolveTaskRange(task);
    const baseId = `task-${task.id}`;

    if (!task.recurrenceRule) {
      return [buildScheduleEvent(task, baseId, baseStartAt, baseEndAt)];
    }

    let rule: ReturnType<typeof parseRRule>;
    try {
      rule = parseRRule(task.recurrenceRule, { dtstart: baseStartAt });
    } catch (error) {
      logError(
        ErrorIds.TASK_SCHEDULE_FAILED,
        'Invalid recurrence rule',
        error,
        { taskId: task.id, rrule: task.recurrenceRule }
      );
      return [buildScheduleEvent(task, baseId, baseStartAt, baseEndAt)];
    }

    const { rangeStart, rangeEnd } = resolveRecurrenceWindow(rule, baseStartAt);
    const occurrences = rule.between(rangeStart, rangeEnd, true);

    if (occurrences.length === 0) {
      return [buildScheduleEvent(task, baseId, baseStartAt, baseEndAt)];
    }

    const durationMs = baseEndAt.getTime() - baseStartAt.getTime();
    return occurrences.map((occurrence) => {
      const startAt = new Date(occurrence);
      const endAt = new Date(startAt.getTime() + durationMs);
      const occurrenceId = `task-${task.id}-occ-${startAt.getTime()}`;
      return buildScheduleEvent(task, occurrenceId, startAt, endAt);
    });
  });

  return { scheduleEvents, occurrenceOverrides };
}
