import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID } from '@/test/fixtures';
import { revalidatePath, revalidateTag } from 'next/cache';

type TaskActions = typeof import('@/lib/actions/tasks');

describe('Task Actions - Create Task', () => {
  let db: ReturnType<typeof getTestDb>;

  let createTask: TaskActions['createTask'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  const revalidatePathMock = vi.mocked(revalidatePath);
  const revalidateTagMock = vi.mocked(revalidateTag);

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    const taskActions = await import('@/lib/actions/tasks');
    createTask = taskActions.createTask;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('createTask', () => {
    it('creates task with due date/time only (no startAt)', async () => {
      const dueAt = new Date('2026-02-01T10:00:00Z');

      const result = await createTask({
        title: 'Due Task',
        dueAt,
      });

      expect(result.success).toBe(true);

      const tasks = await db.select().from(schema.tasks);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Due Task');
      expect(tasks[0].userId).toBe(TEST_USER_ID);
      expect(tasks[0].dueAt).toEqual(dueAt);
      expect(tasks[0].startAt).toBeNull();
      expect(tasks[0].durationMinutes).toBeNull();
      expect(tasks[0].priority).toBe('medium');
      expect(tasks[0].status).toBe('pending');
    });

    it('creates task with start time and duration', async () => {
      const startAt = new Date('2026-02-05T09:00:00Z');
      const dueAt = new Date('2026-02-05T10:30:00Z');

      const result = await createTask({
        title: 'Timed Task',
        description: 'Task description',
        location: 'Desk',
        startAt,
        dueAt,
        durationMinutes: 90,
        priority: 'high',
        status: 'pending',
      });

      expect(result.success).toBe(true);

      const [task] = await db.select().from(schema.tasks);
      expect(task.title).toBe('Timed Task');
      expect(task.description).toBe('Task description');
      expect(task.location).toBe('Desk');
      expect(task.startAt).toEqual(startAt);
      expect(task.dueAt).toEqual(dueAt);
      expect(task.durationMinutes).toBe(90);
      expect(task.priority).toBe('high');
      expect(task.status).toBe('pending');
    });

    it('fails when status completed has no completedAt', async () => {
      const result = await createTask({
        title: 'Completed Task',
        dueAt: new Date('2026-02-01T10:00:00Z'),
        status: 'completed',
      });

      expect(result.success).toBe(false);

      const tasks = await db.select().from(schema.tasks);
      expect(tasks).toHaveLength(0);
    });

    it('revalidates calendar and tasks paths', async () => {
      const result = await createTask({
        title: 'Revalidate Task',
        dueAt: new Date('2026-02-01T10:00:00Z'),
      });

      expect(result.success).toBe(true);

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidatePathMock).toHaveBeenCalledWith('/tasks');
      expect(revalidateTagMock).toHaveBeenCalledWith('tasks', 'default');
    });
  });
});
