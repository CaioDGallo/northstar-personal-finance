import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestEvent, createTestTask } from '@/test/fixtures';
import { and, eq } from 'drizzle-orm';

type NotificationActions = typeof import('@/lib/actions/notifications');

describe('Notification Scheduling', () => {
  let db: ReturnType<typeof getTestDb>;
  let scheduleNotificationJobs: NotificationActions['scheduleNotificationJobs'];
  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;
  let getUserSettingsMock: ReturnType<typeof vi.fn>;
  const OTHER_USER_ID = 'other-user-id';

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    getUserSettingsMock = vi.fn();
    vi.doMock('@/lib/actions/user-settings', () => ({
      getUserSettings: getUserSettingsMock,
    }));

    const notificationActions = await import('@/lib/actions/notifications');
    scheduleNotificationJobs = notificationActions.scheduleNotificationJobs;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('creates notification jobs at the configured offsets', async () => {
    const dueAt = new Date('2026-03-01T10:00:00Z');
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Notify Task', dueAt }))
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

    getUserSettingsMock.mockResolvedValue({ notificationsEnabled: true });

    await scheduleNotificationJobs('task', task.id, dueAt);

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(2);

    const scheduledTimes = jobs.map((job) => job.scheduledAt.getTime());
    expect(scheduledTimes).toContain(new Date(dueAt.getTime() - 15 * 60000).getTime());
    expect(scheduledTimes).toContain(new Date(dueAt.getTime() - 60 * 60000).getTime());
  });

  it('reschedules notification jobs without duplicates', async () => {
    const initialDueAt = new Date('2026-03-01T10:00:00Z');
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Reschedule Task', dueAt: initialDueAt }))
      .returning();

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'task',
        itemId: task.id,
        offsetMinutes: 30,
        channel: 'email',
        enabled: true,
      })
      .returning();

    await db.insert(schema.notificationJobs).values({
      itemType: 'task',
      itemId: task.id,
      notificationId: notification.id,
      channel: 'email',
      scheduledAt: new Date('2026-03-01T09:30:00Z'),
      status: 'pending',
    });

    const [otherTask] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Other Task' }))
      .returning();

    const [otherNotification] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'task',
        itemId: otherTask.id,
        offsetMinutes: 45,
        channel: 'email',
        enabled: true,
      })
      .returning();

    await db.insert(schema.notificationJobs).values({
      itemType: 'task',
      itemId: otherTask.id,
      notificationId: otherNotification.id,
      channel: 'email',
      scheduledAt: new Date('2026-03-02T09:30:00Z'),
      status: 'pending',
    });

    getUserSettingsMock.mockResolvedValue({ notificationsEnabled: true });

    const newDueAt = new Date('2026-03-01T12:00:00Z');
    await scheduleNotificationJobs('task', task.id, newDueAt);

    const jobs = await db
      .select()
      .from(schema.notificationJobs)
      .where(
        and(eq(schema.notificationJobs.itemType, 'task'), eq(schema.notificationJobs.itemId, task.id))
      );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.scheduledAt).toEqual(new Date(newDueAt.getTime() - 30 * 60000));

    const otherJobs = await db
      .select()
      .from(schema.notificationJobs)
      .where(
        and(eq(schema.notificationJobs.itemType, 'task'), eq(schema.notificationJobs.itemId, otherTask.id))
      );
    expect(otherJobs).toHaveLength(1);
  });

  it('skips scheduling when notifications are disabled', async () => {
    const dueAt = new Date('2026-04-01T10:00:00Z');
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Disabled Task', dueAt }))
      .returning();

    await db.insert(schema.notifications).values({
      itemType: 'task',
      itemId: task.id,
      offsetMinutes: 15,
      channel: 'email',
      enabled: true,
    });

    getUserSettingsMock.mockResolvedValue({ notificationsEnabled: false });

    await scheduleNotificationJobs('task', task.id, dueAt);

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(0);
  });

  it('creates notification jobs for events and ignores disabled configs', async () => {
    const startAt = new Date('2026-05-10T14:00:00Z');
    const endAt = new Date('2026-05-10T15:00:00Z');
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'Event With Notifications', startAt, endAt }))
      .returning();

    await db.insert(schema.notifications).values([
      {
        itemType: 'event',
        itemId: event.id,
        offsetMinutes: 30,
        channel: 'email',
        enabled: true,
      },
      {
        itemType: 'event',
        itemId: event.id,
        offsetMinutes: 120,
        channel: 'email',
        enabled: false,
      },
    ]);

    getUserSettingsMock.mockResolvedValue({ notificationsEnabled: true });

    await scheduleNotificationJobs('event', event.id, startAt);

    const jobs = await db
      .select()
      .from(schema.notificationJobs)
      .where(and(eq(schema.notificationJobs.itemType, 'event'), eq(schema.notificationJobs.itemId, event.id)));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.scheduledAt).toEqual(new Date(startAt.getTime() - 30 * 60000));
  });

  it('skips scheduling when the parent item is not owned', async () => {
    const startAt = new Date('2026-06-01T09:00:00Z');
    const endAt = new Date('2026-06-01T10:00:00Z');
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ userId: OTHER_USER_ID, startAt, endAt }))
      .returning();

    await db.insert(schema.notifications).values({
      itemType: 'event',
      itemId: event.id,
      offsetMinutes: 45,
      channel: 'email',
      enabled: true,
    });

    getUserSettingsMock.mockResolvedValue({ notificationsEnabled: true });

    await scheduleNotificationJobs('event', event.id, startAt);

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(0);
  });
});
