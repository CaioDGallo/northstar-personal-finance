import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { TEST_USER_ID, createTestEvent, createTestTask } from '@/test/fixtures';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

type NotificationJobActions = typeof import('@/lib/actions/notification-jobs');

describe('Notification Jobs', () => {
  let db: ReturnType<typeof getTestDb>;
  let processPendingNotificationJobs: NotificationJobActions['processPendingNotificationJobs'];
  let fetchMock: ReturnType<typeof vi.fn>;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));

    const actions = await import('@/lib/actions/notification-jobs');
    processPendingNotificationJobs = actions.processPendingNotificationJobs;
  });

  afterAll(async () => {
    process.env = originalEnv;
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-12T12:00:00Z'));

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels job when item is missing', async () => {
    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'event',
        itemId: 9999,
        channel: 'email',
        scheduledAt: new Date('2026-01-10T00:00:00Z'),
        status: 'pending',
        attempts: 0,
      })
      .returning();

    const result = await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('cancelled');
    expect(updated.lastError).toBe('Item no longer valid');
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it('cancels job when event status is not scheduled', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ status: 'completed' }))
      .returning();

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'event',
        itemId: event.id,
        channel: 'email',
        scheduledAt: new Date('2026-01-10T00:00:00Z'),
        status: 'pending',
        attempts: 0,
      })
      .returning();

    await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('cancelled');
  });

  it('cancels job when task status is not eligible', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ status: 'completed' }))
      .returning();

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'task',
        itemId: task.id,
        channel: 'email',
        scheduledAt: new Date('2026-01-10T00:00:00Z'),
        status: 'pending',
        attempts: 0,
      })
      .returning();

    await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('cancelled');
  });

  it('marks job as sent on successful notification', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'Upcoming Event' }))
      .returning();

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'event',
        itemId: event.id,
        channel: 'email',
        scheduledAt: new Date('2026-01-10T00:00:00Z'),
        status: 'pending',
        attempts: 0,
      })
      .returning();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('sent');
    expect(updated.sentAt).toBeTruthy();
    expect(result).toEqual({ processed: 1, failed: 0 });
  });

  it('increments attempts on failed send below retry limit', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Failed Task' }))
      .returning();

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'task',
        itemId: task.id,
        channel: 'email',
        scheduledAt: new Date('2026-01-10T00:00:00Z'),
        status: 'pending',
        attempts: 1,
      })
      .returning();

    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Send failed' }),
    });

    const result = await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('pending');
    expect(updated.attempts).toBe(2);
    expect(updated.lastError).toBe('Send failed');
    expect(result).toEqual({ processed: 0, failed: 1 });
  });

  it('marks job as failed after max attempts', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Give Up Task' }))
      .returning();

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'task',
        itemId: task.id,
        channel: 'email',
        scheduledAt: new Date('2026-01-10T00:00:00Z'),
        status: 'pending',
        attempts: 3,
      })
      .returning();

    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Still failing' }),
    });

    const result = await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('failed');
    expect(updated.lastError).toBe('Still failing');
    expect(result).toEqual({ processed: 0, failed: 1 });
  });
});
