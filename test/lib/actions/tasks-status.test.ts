import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestTask } from '@/test/fixtures';
import { revalidatePath, revalidateTag } from 'next/cache';
import { eq } from 'drizzle-orm';

type TaskActions = typeof import('@/lib/actions/tasks');

const OTHER_USER_ID = 'other-user-id';

describe('Task Actions - Status Changes', () => {
  let db: ReturnType<typeof getTestDb>;

  let completeTask: TaskActions['completeTask'];
  let cancelTask: TaskActions['cancelTask'];
  let startTask: TaskActions['startTask'];

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
    completeTask = taskActions.completeTask;
    cancelTask = taskActions.cancelTask;
    startTask = taskActions.startTask;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('completeTask', () => {
    it('sets status to completed and sets completedAt', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task to Complete' }))
        .returning();

      const originalUpdatedAt = task.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await completeTask(task.id);

      expect(result.success).toBe(true);

      const [updatedTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.completedAt).toBeDefined();
      expect(updatedTask.updatedAt).not.toEqual(originalUpdatedAt);
      expect(updatedTask.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt!.getTime());
    });

    it('only affects tasks owned by current user', async () => {
      const [otherTask] = await db
        .insert(schema.tasks)
        .values(createTestTask({ userId: OTHER_USER_ID, title: 'Other Users Task' }))
        .returning();

      const result = await completeTask(otherTask.id);

      expect(result.success).toBe(true);

      const [unchangedTask] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, otherTask.id));
      expect(unchangedTask.status).toBe('pending');
      expect(unchangedTask.completedAt).toBeNull();
    });

    it('revalidates calendar and tasks paths', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task to Revalidate' }))
        .returning();

      await completeTask(task.id);

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidatePathMock).toHaveBeenCalledWith('/tasks');
      expect(revalidateTagMock).toHaveBeenCalledWith('tasks', 'default');
    });
  });

  describe('startTask', () => {
    it('sets status to in_progress', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task to Start' }))
        .returning();

      const result = await startTask(task.id);

      expect(result.success).toBe(true);

      const [updatedTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.completedAt).toBeNull();
    });
  });

  describe('cancelTask', () => {
    it('sets status to cancelled', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task to Cancel' }))
        .returning();

      const result = await cancelTask(task.id);

      expect(result.success).toBe(true);

      const [updatedTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
      expect(updatedTask.status).toBe('cancelled');
      expect(updatedTask.completedAt).toBeNull();
    });
  });
});
