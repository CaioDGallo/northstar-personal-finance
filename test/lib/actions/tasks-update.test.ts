import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestTask } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type TaskActions = typeof import('@/lib/actions/tasks');

const OTHER_USER_ID = 'other-user-id';

describe('Task Actions - Update Task', () => {
  let db: ReturnType<typeof getTestDb>;

  let updateTask: TaskActions['updateTask'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

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
    updateTask = taskActions.updateTask;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('updates task fields and preserves ownership', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Original', location: 'Room A' }))
      .returning();

    const newStartAt = new Date('2026-02-02T09:00:00Z');
    const newDueAt = new Date('2026-02-02T10:00:00Z');

    const result = await updateTask(task.id, {
      title: 'Updated',
      description: 'Updated description',
      location: 'Room B',
      startAt: newStartAt,
      dueAt: newDueAt,
      durationMinutes: 60,
    });

    expect(result).toEqual({ success: true });

    const [updated] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(updated.title).toBe('Updated');
    expect(updated.description).toBe('Updated description');
    expect(updated.location).toBe('Room B');
    expect(updated.startAt).toEqual(newStartAt);
    expect(updated.dueAt).toEqual(newDueAt);
    expect(updated.durationMinutes).toBe(60);
    expect(updated.userId).toBe(TEST_USER_ID);
  });

  it('supports partial updates without overwriting other fields', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Original', description: 'Keep me' }))
      .returning();

    const result = await updateTask(task.id, { title: 'Only Title Updated' });
    expect(result).toEqual({ success: true });

    const [updated] = await db.select().from(schema.tasks);
    expect(updated.title).toBe('Only Title Updated');
    expect(updated.description).toBe('Keep me');
    expect(updated.dueAt).toEqual(task.dueAt);
    expect(updated.startAt).toEqual(task.startAt);
  });

  it('returns notFound when task belongs to another user', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ userId: OTHER_USER_ID, title: 'Other Task' }))
      .returning();

    const result = await updateTask(task.id, { title: 'Should Not Update' });

    expect(result.success).toBe(false);

    const [unchanged] = await db.select().from(schema.tasks);
    expect(unchanged.title).toBe('Other Task');
  });

  it('reschedules notification jobs when dueAt changes', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Task With Notifications' }))
      .returning();

    const [notification1] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'task',
        itemId: task.id,
        offsetMinutes: 15,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const [notification2] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'task',
        itemId: task.id,
        offsetMinutes: 60,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const newDueAt = new Date('2026-03-01T10:00:00Z');
    const result = await updateTask(task.id, { dueAt: newDueAt });

    expect(result).toEqual({ success: true });

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(2);

    const job1 = jobs.find((job) => job.notificationId === notification1.id);
    expect(job1).toBeDefined();
    expect(job1?.scheduledAt).toEqual(new Date(newDueAt.getTime() - 15 * 60000));

    const job2 = jobs.find((job) => job.notificationId === notification2.id);
    expect(job2).toBeDefined();
    expect(job2?.scheduledAt).toEqual(new Date(newDueAt.getTime() - 60 * 60000));
  });

  it('does not reschedule notification jobs when dueAt is not provided', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'No Reschedule' }))
      .returning();

    await db.insert(schema.notifications).values({
      itemType: 'task',
      itemId: task.id,
      offsetMinutes: 30,
      channel: 'email',
      enabled: true,
    });

    const result = await updateTask(task.id, { title: 'Updated Title' });
    expect(result).toEqual({ success: true });

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(0);
  });

  it('fails when status completed has no completedAt', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Incomplete Completion' }))
      .returning();

    const result = await updateTask(task.id, { status: 'completed' });

    expect(result.success).toBe(false);

    const [unchanged] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(unchanged.status).toBe('pending');
    expect(unchanged.completedAt).toBeNull();
  });
});
