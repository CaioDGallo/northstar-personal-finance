import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestEvent, createTestTask } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type NotificationActions = typeof import('@/lib/actions/notifications');

const OTHER_USER_ID = 'other-user-id';

describe('Notification Actions', () => {
  let db: ReturnType<typeof getTestDb>;

  let createNotification: NotificationActions['createNotification'];
  let updateNotification: NotificationActions['updateNotification'];
  let deleteNotification: NotificationActions['deleteNotification'];
  let getNotificationsByItem: NotificationActions['getNotificationsByItem'];

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

    const notificationActions = await import('@/lib/actions/notifications');
    createNotification = notificationActions.createNotification;
    updateNotification = notificationActions.updateNotification;
    deleteNotification = notificationActions.deleteNotification;
    getNotificationsByItem = notificationActions.getNotificationsByItem;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('creates notifications for owned items', async () => {
    const [event] = await db.insert(schema.events).values(createTestEvent()).returning();

    const result = await createNotification({
      itemType: 'event',
      itemId: event.id,
      offsetMinutes: 30,
      channel: 'email',
      enabled: true,
    });

    expect(result).toEqual({ success: true });

    const notifications = await db.select().from(schema.notifications);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.itemId).toBe(event.id);
  });

  it('updates notifications when the user owns the parent item', async () => {
    const [task] = await db.insert(schema.tasks).values(createTestTask()).returning();
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

    const result = await updateNotification(notification.id, { offsetMinutes: 45, enabled: false });

    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, notification.id));
    expect(updated.offsetMinutes).toBe(45);
    expect(updated.enabled).toBe(false);
    expect(updated.updatedAt).toBeDefined();
  });

  it('rejects notification updates when the user does not own the parent item', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ userId: OTHER_USER_ID }))
      .returning();
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'event',
        itemId: event.id,
        offsetMinutes: 10,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const result = await updateNotification(notification.id, { enabled: false });

    expect(result.success).toBe(false);

    const [unchanged] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, notification.id));
    expect(unchanged.enabled).toBe(true);
  });

  it('deletes notifications when the user owns the parent item', async () => {
    const [task] = await db.insert(schema.tasks).values(createTestTask()).returning();
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'task',
        itemId: task.id,
        offsetMinutes: 5,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const result = await deleteNotification(notification.id);
    expect(result).toEqual({ success: true });

    const remaining = await db.select().from(schema.notifications);
    expect(remaining).toHaveLength(0);
  });

  it('rejects notification deletions when the user does not own the parent item', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ userId: OTHER_USER_ID }))
      .returning();
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'task',
        itemId: task.id,
        offsetMinutes: 20,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const result = await deleteNotification(notification.id);
    expect(result.success).toBe(false);

    const remaining = await db.select().from(schema.notifications);
    expect(remaining).toHaveLength(1);
  });

  it('returns notifications for owned items and nothing for non-owned items', async () => {
    const [task] = await db.insert(schema.tasks).values(createTestTask()).returning();
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

    const ownedNotifications = await getNotificationsByItem('task', task.id);
    expect(ownedNotifications).toHaveLength(2);

    const [otherTask] = await db
      .insert(schema.tasks)
      .values(createTestTask({ userId: OTHER_USER_ID }))
      .returning();
    await db.insert(schema.notifications).values({
      itemType: 'task',
      itemId: otherTask.id,
      offsetMinutes: 30,
      channel: 'email',
      enabled: true,
    });

    const otherNotifications = await getNotificationsByItem('task', otherTask.id);
    expect(otherNotifications).toHaveLength(0);
  });

  it('returns empty when the parent item does not exist', async () => {
    await db.insert(schema.notifications).values({
      itemType: 'event',
      itemId: 9999,
      offsetMinutes: 30,
      channel: 'email',
      enabled: true,
    });

    const notifications = await getNotificationsByItem('event', 9999);
    expect(notifications).toHaveLength(0);
  });
});
