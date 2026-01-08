import { describe, it, expect } from 'vitest';
import { filterTasks, resolveTaskRange } from '@/lib/tasks-utils';

describe('tasks-utils', () => {
  describe('resolveTaskRange', () => {
    it('uses dueAt for tasks without startAt/duration', () => {
      const dueAt = new Date('2026-02-01T10:00:00Z');

      const range = resolveTaskRange({
        dueAt,
        startAt: null,
        durationMinutes: null,
      });

      expect(range.startAt).toEqual(dueAt);
      expect(range.endAt).toEqual(dueAt);
    });

    it('uses startAt + durationMinutes when provided', () => {
      const startAt = new Date('2026-02-01T08:00:00Z');
      const dueAt = new Date('2026-02-01T10:00:00Z');

      const range = resolveTaskRange({
        dueAt,
        startAt,
        durationMinutes: 90,
      });

      expect(range.startAt).toEqual(startAt);
      expect(range.endAt).toEqual(new Date(startAt.getTime() + 90 * 60000));
    });
  });

  describe('filterTasks', () => {
    it('filters by status and priority and excludes cancelled tasks', () => {
      const tasks = [
        { id: 1, status: 'pending', priority: 'medium' },
        { id: 2, status: 'completed', priority: 'high' },
        { id: 3, status: 'cancelled', priority: 'low' },
        { id: 4, status: 'in_progress', priority: 'low' },
      ] satisfies Array<{
        id: number;
        status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
        priority: 'low' | 'medium' | 'high' | 'critical';
      }>;

      const statusFilters = { pending: true, inProgress: true, completed: false };
      const priorityFilters = { low: true, medium: true, high: true, critical: true };

      const filtered = filterTasks(tasks, statusFilters, priorityFilters);

      expect(filtered.map((task) => task.id)).toEqual([1, 4]);
    });

    it('filters out disabled priorities', () => {
      const tasks = [
        { id: 1, status: 'pending', priority: 'medium' },
        { id: 2, status: 'pending', priority: 'low' },
      ] satisfies Array<{
        id: number;
        status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
        priority: 'low' | 'medium' | 'high' | 'critical';
      }>;

      const statusFilters = { pending: true, inProgress: true, completed: true };
      const priorityFilters = { low: false, medium: true, high: true, critical: true };

      const filtered = filterTasks(tasks, statusFilters, priorityFilters);

      expect(filtered.map((task) => task.id)).toEqual([1]);
    });
  });
});
