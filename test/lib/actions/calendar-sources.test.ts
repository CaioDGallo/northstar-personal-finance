import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import { TEST_USER_ID } from '@/test/fixtures';
import * as schema from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

type CalendarSourcesActions = typeof import('@/lib/actions/calendar-sources');

describe('Calendar Sources Actions', () => {
  let db: ReturnType<typeof getTestDb>;
  let createCalendarSource: CalendarSourcesActions['createCalendarSource'];
  let updateCalendarSource: CalendarSourcesActions['updateCalendarSource'];
  let deleteCalendarSource: CalendarSourcesActions['deleteCalendarSource'];

  const tMock = vi.fn(async (key: string) => key);
  const revalidatePathMock = vi.mocked(revalidatePath);
  const revalidateTagMock = vi.mocked(revalidateTag);

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    mockAuth();
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));

    const actions = await import('@/lib/actions/calendar-sources');
    createCalendarSource = actions.createCalendarSource;
    updateCalendarSource = actions.updateCalendarSource;
    deleteCalendarSource = actions.deleteCalendarSource;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
  });

  it('rejects invalid URL on create', async () => {
    const result = await createCalendarSource({
      name: 'Bad URL',
      url: 'not-a-url',
      color: '#3b82f6',
      status: 'active',
    });

    expect(result).toEqual({ success: false, error: 'errors.invalidUrl' });
  });

  it('creates calendar source and revalidates', async () => {
    const result = await createCalendarSource({
      name: 'Team Calendar',
      url: 'https://example.com/calendar.ics',
      color: '#3b82f6',
      status: 'active',
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBeTypeOf('number');

    const [source] = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.userId, TEST_USER_ID));
    expect(source.name).toBe('Team Calendar');

    expect(revalidatePathMock).toHaveBeenCalledWith('/settings/calendars');
    expect(revalidateTagMock).toHaveBeenCalledWith('calendar-sources', 'default');
  });

  it('rejects duplicate URL per user', async () => {
    await db.insert(schema.calendarSources).values({
      userId: TEST_USER_ID,
      name: 'Primary',
      url: 'https://example.com/calendar.ics',
      color: '#3b82f6',
      status: 'active',
    });

    const result = await createCalendarSource({
      name: 'Duplicate',
      url: 'https://example.com/calendar.ics',
      color: '#3b82f6',
      status: 'active',
    });

    expect(result.success).toBe(false);
    expect(['errors.duplicateEntry', 'errors.failedToCreate']).toContain(result.error);
  });

  it('returns notFound when updating missing source', async () => {
    const result = await updateCalendarSource(9999, { name: 'Missing' });
    expect(result).toEqual({ success: false, error: 'errors.notFound' });
  });

  it('validates URL on update', async () => {
    const [source] = await db
      .insert(schema.calendarSources)
      .values({
        userId: TEST_USER_ID,
        name: 'My Calendar',
        url: 'https://example.com/old.ics',
        color: '#3b82f6',
        status: 'active',
      })
      .returning();

    const result = await updateCalendarSource(source.id, { url: 'bad-url' });
    expect(result).toEqual({ success: false, error: 'errors.invalidUrl' });
  });

  it('updates calendar source and revalidates', async () => {
    const [source] = await db
      .insert(schema.calendarSources)
      .values({
        userId: TEST_USER_ID,
        name: 'Work Calendar',
        url: 'https://example.com/work.ics',
        color: '#3b82f6',
        status: 'active',
      })
      .returning();

    const result = await updateCalendarSource(source.id, {
      name: 'Updated Calendar',
      url: 'https://example.com/updated.ics',
    });

    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.id, source.id));
    expect(updated.name).toBe('Updated Calendar');
    expect(updated.url).toBe('https://example.com/updated.ics');

    expect(revalidatePathMock).toHaveBeenCalledWith('/settings/calendars');
    expect(revalidateTagMock).toHaveBeenCalledWith('calendar-sources', 'default');
  });

  it('deletes calendar source, cascades events, and revalidates', async () => {
    const [source] = await db
      .insert(schema.calendarSources)
      .values({
        userId: TEST_USER_ID,
        name: 'Delete Me',
        url: 'https://example.com/delete.ics',
        color: '#3b82f6',
        status: 'active',
      })
      .returning();

    await db.insert(schema.events).values({
      userId: TEST_USER_ID,
      title: 'Linked Event',
      startAt: new Date('2026-02-01T10:00:00Z'),
      endAt: new Date('2026-02-01T11:00:00Z'),
      calendarSourceId: source.id,
    });

    const result = await deleteCalendarSource(source.id);
    expect(result).toEqual({ success: true });

    const sources = await db
      .select()
      .from(schema.calendarSources)
      .where(and(eq(schema.calendarSources.userId, TEST_USER_ID), eq(schema.calendarSources.id, source.id)));
    expect(sources).toHaveLength(0);

    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.calendarSourceId, source.id));
    expect(events).toHaveLength(0);

    expect(revalidatePathMock).toHaveBeenCalledWith('/settings/calendars');
    expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
    expect(revalidateTagMock).toHaveBeenCalledWith('calendar-sources', 'default');
    expect(revalidateTagMock).toHaveBeenCalledWith('events', 'default');
  });
});
