import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID } from '@/test/fixtures';
import { revalidatePath, revalidateTag } from 'next/cache';
import { eq } from 'drizzle-orm';

type EventsActions = typeof import('@/lib/actions/events');

const OTHER_USER_ID = 'other-user-id';

describe('Event Actions - Status Changes', () => {
  let db: ReturnType<typeof getTestDb>;

  let completeEvent: EventsActions['completeEvent'];
  let cancelEvent: EventsActions['cancelEvent'];

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
    completeEvent = eventActions.completeEvent;
    cancelEvent = eventActions.cancelEvent;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('completeEvent', () => {
    it('sets status to completed and updates updatedAt', async () => {
      // Create test event with scheduled status
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event to Complete',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status: 'scheduled',
        })
        .returning();

      const originalUpdatedAt = event.updatedAt;

      // Small delay to ensure updatedAt changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await completeEvent(event.id);

      expect(result.success).toBe(true);

      // Verify status changed to completed
      const [updatedEvent] = await db.select().from(schema.events).where(eq(schema.events.id, event.id));
      expect(updatedEvent.status).toBe('completed');

      // Verify updatedAt was updated
      expect(updatedEvent.updatedAt).not.toEqual(originalUpdatedAt);
      expect(updatedEvent.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt!.getTime());
    });

    it('only affects events owned by current user', async () => {
      // Create event owned by different user
      const [otherEvent] = await db
        .insert(schema.events)
        .values({
          userId: OTHER_USER_ID,
          title: 'Other Users Event',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status: 'scheduled',
        })
        .returning();

      const result = await completeEvent(otherEvent.id);

      expect(result.success).toBe(true);

      // Verify event status was NOT changed (still scheduled)
      const [unchangedEvent] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, otherEvent.id));
      expect(unchangedEvent.status).toBe('scheduled');
    });

    it('handles non-existent event gracefully', async () => {
      const result = await completeEvent(99999);

      expect(result.success).toBe(true);

      // No error should be thrown for missing event
    });

    it('revalidates calendar path and events tag', async () => {
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event to Complete',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status: 'scheduled',
        })
        .returning();

      await completeEvent(event.id);

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidateTagMock).toHaveBeenCalledWith('events', 'default');
    });
  });

  describe('cancelEvent', () => {
    it('sets status to cancelled and updates updatedAt', async () => {
      // Create test event with scheduled status
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event to Cancel',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status: 'scheduled',
        })
        .returning();

      const originalUpdatedAt = event.updatedAt;

      // Small delay to ensure updatedAt changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await cancelEvent(event.id);

      expect(result.success).toBe(true);

      // Verify status changed to cancelled
      const [updatedEvent] = await db.select().from(schema.events).where(eq(schema.events.id, event.id));
      expect(updatedEvent.status).toBe('cancelled');

      // Verify updatedAt was updated
      expect(updatedEvent.updatedAt).not.toEqual(originalUpdatedAt);
      expect(updatedEvent.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt!.getTime());
    });

    it('only affects events owned by current user', async () => {
      // Create event owned by different user
      const [otherEvent] = await db
        .insert(schema.events)
        .values({
          userId: OTHER_USER_ID,
          title: 'Other Users Event',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status: 'scheduled',
        })
        .returning();

      const result = await cancelEvent(otherEvent.id);

      expect(result.success).toBe(true);

      // Verify event status was NOT changed (still scheduled)
      const [unchangedEvent] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, otherEvent.id));
      expect(unchangedEvent.status).toBe('scheduled');
    });

    it('handles non-existent event gracefully', async () => {
      const result = await cancelEvent(99999);

      expect(result.success).toBe(true);

      // No error should be thrown for missing event
    });

    it('revalidates calendar path and events tag', async () => {
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event to Cancel',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
          status: 'scheduled',
        })
        .returning();

      await cancelEvent(event.id);

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidateTagMock).toHaveBeenCalledWith('events', 'default');
    });
  });
});
