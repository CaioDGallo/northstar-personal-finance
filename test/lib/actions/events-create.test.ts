import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID } from '@/test/fixtures';
import { revalidatePath, revalidateTag } from 'next/cache';

type EventsActions = typeof import('@/lib/actions/events');

describe('Event Actions - Create Event', () => {
  let db: ReturnType<typeof getTestDb>;

  let createEvent: EventsActions['createEvent'];

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

    const eventActions = await import('@/lib/actions/events');
    createEvent = eventActions.createEvent;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('createEvent', () => {
    it('creates event with minimal required fields', async () => {
      const startAt = new Date('2026-02-01T10:00:00Z');
      const endAt = new Date('2026-02-01T11:00:00Z');

      const result = await createEvent({
        title: 'Minimal Event',
        startAt,
        endAt,
      });

      expect(result.success).toBe(true);

      const events = await db.select().from(schema.events);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Minimal Event');
      expect(events[0].userId).toBe(TEST_USER_ID);
      expect(events[0].startAt).toEqual(startAt);
      expect(events[0].endAt).toEqual(endAt);

      // Verify defaults
      expect(events[0].isAllDay).toBe(false);
      expect(events[0].priority).toBe('medium');
      expect(events[0].status).toBe('scheduled');
      expect(events[0].description).toBeNull();
      expect(events[0].location).toBeNull();
    });

    it('creates event with all fields populated', async () => {
      const startAt = new Date('2026-02-15T14:00:00Z');
      const endAt = new Date('2026-02-15T15:30:00Z');

      const result = await createEvent({
        title: 'Full Event',
        description: 'Detailed description of the event',
        location: 'Conference Room A',
        startAt,
        endAt,
        isAllDay: false,
        priority: 'high',
        status: 'scheduled',
      });

      expect(result.success).toBe(true);

      const events = await db.select().from(schema.events);
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.title).toBe('Full Event');
      expect(event.description).toBe('Detailed description of the event');
      expect(event.location).toBe('Conference Room A');
      expect(event.startAt).toEqual(startAt);
      expect(event.endAt).toEqual(endAt);
      expect(event.isAllDay).toBe(false);
      expect(event.priority).toBe('high');
      expect(event.status).toBe('scheduled');
      expect(event.userId).toBe(TEST_USER_ID);
      expect(event.createdAt).toBeDefined();
      expect(event.updatedAt).toBeDefined();
    });

    it('creates all-day event correctly', async () => {
      const result = await createEvent({
        title: 'All Day Event',
        startAt: new Date('2026-03-01T00:00:00Z'),
        endAt: new Date('2026-03-01T23:59:59Z'),
        isAllDay: true,
      });

      expect(result.success).toBe(true);

      const events = await db.select().from(schema.events);
      expect(events).toHaveLength(1);
      expect(events[0].isAllDay).toBe(true);
    });

    it('schedules notification jobs when notification configs exist', async () => {
      const startAt = new Date('2026-02-01T10:00:00Z');
      const endAt = new Date('2026-02-01T11:00:00Z');

      // Create event first
      const result = await createEvent({
        title: 'Event with Notifications',
        startAt,
        endAt,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);

      // Create notification configs for this event
      const [notification1] = await db
        .insert(schema.notifications)
        .values({
          itemType: 'event',
          itemId: event.id,
          offsetMinutes: 15, // 15 minutes before
          channel: 'email',
          enabled: true,
        })
        .returning();

      const [notification2] = await db
        .insert(schema.notifications)
        .values({
          itemType: 'event',
          itemId: event.id,
          offsetMinutes: 60, // 1 hour before
          channel: 'email',
          enabled: true,
        })
        .returning();

      // Import and call scheduleNotificationJobs
      const { scheduleNotificationJobs } = await import('@/lib/actions/notifications');
      await scheduleNotificationJobs('event', event.id, startAt);

      // Verify notification jobs were created
      const jobs = await db.select().from(schema.notificationJobs);
      expect(jobs).toHaveLength(2);

      // Verify job details
      const job1 = jobs.find((j) => j.notificationId === notification1.id);
      expect(job1).toBeDefined();
      expect(job1?.itemType).toBe('event');
      expect(job1?.itemId).toBe(event.id);
      expect(job1?.channel).toBe('email');
      expect(job1?.status).toBe('pending');
      expect(job1?.attempts).toBe(0);
      // 15 minutes before startAt
      expect(job1?.scheduledAt).toEqual(new Date(startAt.getTime() - 15 * 60000));

      const job2 = jobs.find((j) => j.notificationId === notification2.id);
      expect(job2).toBeDefined();
      expect(job2?.itemType).toBe('event');
      expect(job2?.channel).toBe('email');
      // 60 minutes before startAt
      expect(job2?.scheduledAt).toEqual(new Date(startAt.getTime() - 60 * 60000));
    });

    it('does not schedule jobs for disabled notification configs', async () => {
      const startAt = new Date('2026-02-01T10:00:00Z');
      const endAt = new Date('2026-02-01T11:00:00Z');

      const result = await createEvent({
        title: 'Event with Disabled Notifications',
        startAt,
        endAt,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);

      // Create disabled notification config
      await db.insert(schema.notifications).values({
        itemType: 'event',
        itemId: event.id,
        offsetMinutes: 15,
        channel: 'email',
        enabled: false, // Disabled
      });

      const { scheduleNotificationJobs } = await import('@/lib/actions/notifications');
      await scheduleNotificationJobs('event', event.id, startAt);

      // Verify no jobs were created
      const jobs = await db.select().from(schema.notificationJobs);
      expect(jobs).toHaveLength(0);
    });

    it('returns success result on successful creation', async () => {
      const result = await createEvent({
        title: 'Success Test',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T11:00:00Z'),
      });

      expect(result).toEqual({ success: true });
    });

    it('returns error result when creation fails', async () => {
      // Cause a database constraint violation by setting endAt before startAt
      const result = await createEvent({
        title: 'Error Test',
        startAt: new Date('2026-02-01T11:00:00Z'),
        endAt: new Date('2026-02-01T10:00:00Z'), // Before startAt
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }

      // Verify event was not created
      const events = await db.select().from(schema.events);
      expect(events).toHaveLength(0);
    });

    it('sets userId automatically from current user', async () => {
      const result = await createEvent({
        title: 'User ID Test',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T11:00:00Z'),
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.userId).toBe(TEST_USER_ID);
    });

    it('revalidates calendar path and events tag on create', async () => {
      await createEvent({
        title: 'Revalidation Test',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T11:00:00Z'),
      });

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidateTagMock).toHaveBeenCalledWith('events', 'default');
    });

    it('accepts all priority levels', async () => {
      const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        await clearAllTables();

        const result = await createEvent({
          title: `${priority} priority event`,
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          priority,
        });

        expect(result.success).toBe(true);

        const [event] = await db.select().from(schema.events);
        expect(event.priority).toBe(priority);
      }
    });

    it('accepts all status values', async () => {
      const statuses: Array<'scheduled' | 'completed' | 'cancelled'> = ['scheduled', 'completed', 'cancelled'];

      for (const status of statuses) {
        await clearAllTables();

        const result = await createEvent({
          title: `${status} event`,
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status,
        });

        expect(result.success).toBe(true);

        const [event] = await db.select().from(schema.events);
        expect(event.status).toBe(status);
      }
    });
  });
});
