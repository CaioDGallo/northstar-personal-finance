import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestTask } from '@/test/fixtures';
import { revalidatePath, revalidateTag } from 'next/cache';
import { eq, and } from 'drizzle-orm';

type TaskActions = typeof import('@/lib/actions/tasks');

describe('Task Actions - Delete Task', () => {
  let db: ReturnType<typeof getTestDb>;

  let deleteTask: TaskActions['deleteTask'];

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
    deleteTask = taskActions.deleteTask;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('deleteTask', () => {
    it('deletes task successfully', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task to Delete' }))
        .returning();

      const result = await deleteTask(task.id);

      expect(result.success).toBe(true);

      const tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
      expect(tasks).toHaveLength(0);
    });

    it('cascades delete to notificationJobs', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task with Notification Jobs' }))
        .returning();

      const [notification] = await db
        .insert(schema.notifications)
        .values({
          itemType: 'task',
          itemId: task.id,
          offsetMinutes: 15,
          channel: 'email',
          enabled: true,
        })
        .returning();

      await db.insert(schema.notificationJobs).values([
        {
          itemType: 'task',
          itemId: task.id,
          notificationId: notification.id,
          channel: 'email',
          scheduledAt: new Date('2026-02-01T09:45:00Z'),
          status: 'pending',
        },
        {
          itemType: 'task',
          itemId: task.id,
          notificationId: notification.id,
          channel: 'email',
          scheduledAt: new Date('2026-02-01T09:00:00Z'),
          status: 'pending',
        },
      ]);

      const [otherTask] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Other Task' }))
        .returning();

      const [otherNotification] = await db
        .insert(schema.notifications)
        .values({
          itemType: 'task',
          itemId: otherTask.id,
          offsetMinutes: 15,
          channel: 'email',
          enabled: true,
        })
        .returning();

      await db.insert(schema.notificationJobs).values({
        itemType: 'task',
        itemId: otherTask.id,
        notificationId: otherNotification.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-02T09:45:00Z'),
        status: 'pending',
      });

      const result = await deleteTask(task.id);

      expect(result.success).toBe(true);

      const deletedTaskJobs = await db
        .select()
        .from(schema.notificationJobs)
        .where(
          and(eq(schema.notificationJobs.itemType, 'task'), eq(schema.notificationJobs.itemId, task.id))
        );
      expect(deletedTaskJobs).toHaveLength(0);

      const otherTaskJobs = await db
        .select()
        .from(schema.notificationJobs)
        .where(
          and(eq(schema.notificationJobs.itemType, 'task'), eq(schema.notificationJobs.itemId, otherTask.id))
        );
      expect(otherTaskJobs).toHaveLength(1);
    });

    it('cascades delete to notifications', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task with Notifications' }))
        .returning();

      await db.insert(schema.notifications).values([
        {
          itemType: 'task',
          itemId: task.id,
          offsetMinutes: 15,
          channel: 'email',
          enabled: true,
        },
        {
          itemType: 'task',
          itemId: task.id,
          offsetMinutes: 60,
          channel: 'email',
          enabled: true,
        },
      ]);

      const [otherTask] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Other Task' }))
        .returning();

      await db.insert(schema.notifications).values({
        itemType: 'task',
        itemId: otherTask.id,
        offsetMinutes: 15,
        channel: 'email',
        enabled: true,
      });

      const result = await deleteTask(task.id);

      expect(result.success).toBe(true);

      const deletedTaskNotifications = await db
        .select()
        .from(schema.notifications)
        .where(
          and(eq(schema.notifications.itemType, 'task'), eq(schema.notifications.itemId, task.id))
        );
      expect(deletedTaskNotifications).toHaveLength(0);

      const otherTaskNotifications = await db
        .select()
        .from(schema.notifications)
        .where(
          and(eq(schema.notifications.itemType, 'task'), eq(schema.notifications.itemId, otherTask.id))
        );
      expect(otherTaskNotifications).toHaveLength(1);
    });

    it('cascades delete to recurrence rules', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Task with Recurrence' }))
        .returning();

      await db.insert(schema.recurrenceRules).values({
        itemType: 'task',
        itemId: task.id,
        rrule: 'FREQ=WEEKLY;COUNT=4',
      });

      const [otherTask] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Other Task' }))
        .returning();

      await db.insert(schema.recurrenceRules).values({
        itemType: 'task',
        itemId: otherTask.id,
        rrule: 'FREQ=DAILY;COUNT=2',
      });

      const result = await deleteTask(task.id);

      expect(result.success).toBe(true);

      const deletedTaskRules = await db
        .select()
        .from(schema.recurrenceRules)
        .where(
          and(eq(schema.recurrenceRules.itemType, 'task'), eq(schema.recurrenceRules.itemId, task.id))
        );
      expect(deletedTaskRules).toHaveLength(0);

      const otherTaskRules = await db
        .select()
        .from(schema.recurrenceRules)
        .where(
          and(eq(schema.recurrenceRules.itemType, 'task'), eq(schema.recurrenceRules.itemId, otherTask.id))
        );
      expect(otherTaskRules).toHaveLength(1);
    });

    it('revalidates calendar and tasks paths', async () => {
      const [task] = await db
        .insert(schema.tasks)
        .values(createTestTask({ title: 'Revalidate Delete' }))
        .returning();

      await deleteTask(task.id);

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidatePathMock).toHaveBeenCalledWith('/tasks');
      expect(revalidateTagMock).toHaveBeenCalledWith('tasks', 'default');
    });
  });
});
