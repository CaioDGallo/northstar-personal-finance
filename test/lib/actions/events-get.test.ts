import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestEvent } from '@/test/fixtures';

type EventsActions = typeof import('@/lib/actions/events');

const OTHER_USER_ID = 'other-user-id';

describe('Event Actions - Get Operations', () => {
  let db: ReturnType<typeof getTestDb>;

  let getEvents: EventsActions['getEvents'];
  let getEventById: EventsActions['getEventById'];

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

    const eventActions = await import('@/lib/actions/events');
    getEvents = eventActions.getEvents;
    getEventById = eventActions.getEventById;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('getEvents', () => {
    it('returns empty array when user has no events', async () => {
      const events = await getEvents();
      expect(events).toEqual([]);
    });

    it('returns events for current user only, filtered by userId', async () => {
      // Insert events for test user
      await db.insert(schema.events).values([
        createTestEvent({ title: 'User Event 1' }),
        createTestEvent({ title: 'User Event 2' }),
      ]);

      // Insert event for other user (should not be returned)
      await db.insert(schema.events).values([
        createTestEvent({
          userId: OTHER_USER_ID,
          title: 'Other User Event'
        }),
      ]);

      const events = await getEvents();

      expect(events).toHaveLength(2);
      expect(events.map((e) => e.title)).toEqual([
        'User Event 1',
        'User Event 2',
      ]);
      expect(events.every((e) => e.userId === TEST_USER_ID)).toBe(true);
    });

    it('returns events ordered by startAt ascending', async () => {
      await db.insert(schema.events).values([
        createTestEvent({
          title: 'Event C',
          startAt: new Date('2026-03-01T10:00:00Z'),
          endAt: new Date('2026-03-01T11:00:00Z'),
        }),
        createTestEvent({
          title: 'Event A',
          startAt: new Date('2026-01-01T10:00:00Z'),
          endAt: new Date('2026-01-01T11:00:00Z'),
        }),
        createTestEvent({
          title: 'Event B',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        }),
      ]);

      const events = await getEvents();

      expect(events).toHaveLength(3);
      expect(events.map((e) => e.title)).toEqual([
        'Event A',
        'Event B',
        'Event C',
      ]);

      // Verify dates are actually in order
      const startDates = events.map((e) => e.startAt.getTime());
      expect(startDates).toEqual([...startDates].sort((a, b) => a - b));
    });

    it('handles errors gracefully and returns empty array', async () => {
      // Mock getCurrentUserId to throw an error
      getCurrentUserIdMock.mockRejectedValueOnce(new Error('Auth error'));

      const events = await getEvents();

      expect(events).toEqual([]);
    });
  });

  describe('getEventById', () => {
    it('returns undefined when event does not exist', async () => {
      const event = await getEventById(999);
      expect(event).toBeUndefined();
    });

    it('returns event for current user by id', async () => {
      const [inserted] = await db
        .insert(schema.events)
        .values(createTestEvent({ title: 'Specific Event' }))
        .returning();

      const event = await getEventById(inserted.id);

      expect(event).toBeDefined();
      expect(event?.id).toBe(inserted.id);
      expect(event?.title).toBe('Specific Event');
      expect(event?.userId).toBe(TEST_USER_ID);
    });

    it('does not return event belonging to another user (ownership check)', async () => {
      const [otherUserEvent] = await db
        .insert(schema.events)
        .values(createTestEvent({
          userId: OTHER_USER_ID,
          title: 'Other User Event'
        }))
        .returning();

      const event = await getEventById(otherUserEvent.id);

      expect(event).toBeUndefined();
    });

    it('handles errors gracefully and returns undefined', async () => {
      const [inserted] = await db
        .insert(schema.events)
        .values(createTestEvent())
        .returning();

      // Mock getCurrentUserId to throw an error
      getCurrentUserIdMock.mockRejectedValueOnce(new Error('Auth error'));

      const event = await getEventById(inserted.id);

      expect(event).toBeUndefined();
    });

    it('returns full event data with all fields', async () => {
      const eventData = createTestEvent({
        title: 'Full Event',
        description: 'Test description',
        location: 'Test Location',
        priority: 'high',
        status: 'scheduled',
        isAllDay: false,
      });

      const [inserted] = await db
        .insert(schema.events)
        .values(eventData)
        .returning();

      const event = await getEventById(inserted.id);

      expect(event).toBeDefined();
      expect(event?.title).toBe('Full Event');
      expect(event?.description).toBe('Test description');
      expect(event?.location).toBe('Test Location');
      expect(event?.priority).toBe('high');
      expect(event?.status).toBe('scheduled');
      expect(event?.isAllDay).toBe(false);
    });

    it('enforces ownership when multiple events exist', async () => {
      // Create events for both users
      const [testUserEvent] = await db
        .insert(schema.events)
        .values(createTestEvent({
          title: 'Test User Event',
          userId: TEST_USER_ID
        }))
        .returning();

      const [otherUserEvent] = await db
        .insert(schema.events)
        .values(createTestEvent({
          title: 'Other User Event',
          userId: OTHER_USER_ID
        }))
        .returning();

      // Should get test user's event
      const event1 = await getEventById(testUserEvent.id);
      expect(event1).toBeDefined();
      expect(event1?.title).toBe('Test User Event');

      // Should not get other user's event
      const event2 = await getEventById(otherUserEvent.id);
      expect(event2).toBeUndefined();
    });
  });
});
