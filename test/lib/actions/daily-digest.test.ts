import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { TEST_USER_ID, createTestEvent, createTestTask } from '@/test/fixtures';
import * as schema from '@/lib/schema';

type DailyDigestActions = typeof import('@/lib/actions/daily-digest');

describe('Daily Digest', () => {
  let db: ReturnType<typeof getTestDb>;
  let sendAllDailyDigests: DailyDigestActions['sendAllDailyDigests'];
  let sendEmailMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await setupTestDb();

    sendEmailMock = vi.fn();
    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/email/send', () => ({ sendEmail: sendEmailMock }));

    const actions = await import('@/lib/actions/daily-digest');
    sendAllDailyDigests = actions.sendAllDailyDigests;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips users without notification email and aggregates counts', async () => {
    await db.insert(schema.userSettings).values({
      userId: 'no-email-user',
      notificationsEnabled: true,
    });

    await db.insert(schema.userSettings).values({
      userId: 'fail-user',
      notificationEmail: 'fail@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await db.insert(schema.userSettings).values({
      userId: 'empty-user',
      notificationEmail: 'empty@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await db.insert(schema.userSettings).values({
      userId: 'success-user',
      notificationEmail: 'success@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await db.insert(schema.events).values({
      ...createTestEvent({
        userId: 'fail-user',
        title: 'Fail Event',
        startAt: new Date('2026-02-01T14:00:00Z'),
        endAt: new Date('2026-02-01T15:00:00Z'),
      }),
    });

    await db.insert(schema.events).values({
      ...createTestEvent({
        userId: 'success-user',
        title: 'Success Event',
        startAt: new Date('2026-02-01T16:00:00Z'),
        endAt: new Date('2026-02-01T17:00:00Z'),
      }),
    });

    sendEmailMock.mockImplementation(async (options: { to: string }) => {
      if (options.to === 'fail@example.com') {
        return { success: false, error: 'boom' };
      }
      return { success: true };
    });

    const result = await sendAllDailyDigests();

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      usersProcessed: 3,
      emailsSent: 2,
      emailsFailed: 1,
    });
  });

  it('considers empty day a success without sending email', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    const result = await sendAllDailyDigests();

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      usersProcessed: 1,
      emailsSent: 1,
      emailsFailed: 0,
    });
  });

  it('includes items within user local day boundaries', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'America/Sao_Paulo',
    });

    await db.insert(schema.events).values({
      ...createTestEvent({
        userId: TEST_USER_ID,
        title: 'Local Day Event',
        startAt: new Date('2026-02-01T03:30:00Z'),
        endAt: new Date('2026-02-01T04:00:00Z'),
      }),
    });

    await db.insert(schema.events).values({
      ...createTestEvent({
        userId: TEST_USER_ID,
        title: 'Previous Day Event',
        startAt: new Date('2026-02-01T02:30:00Z'),
        endAt: new Date('2026-02-01T03:00:00Z'),
      }),
    });

    sendEmailMock.mockResolvedValue({ success: true });

    await sendAllDailyDigests();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [options] = sendEmailMock.mock.calls[0];
    expect(options.html).toContain('Local Day Event');
    expect(options.html).not.toContain('Previous Day Event');
  });

  it('includes recurring events and tasks occurring today', async () => {
    vi.setSystemTime(new Date('2026-02-02T12:00:00Z'));

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({
        userId: TEST_USER_ID,
        title: 'Daily Standup',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T10:30:00Z'),
      }))
      .returning();

    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({
        userId: TEST_USER_ID,
        title: 'Recurring Task',
        dueAt: new Date('2026-02-01T15:00:00Z'),
        status: 'pending',
      }))
      .returning();

    await db.insert(schema.recurrenceRules).values({
      itemType: 'event',
      itemId: event.id,
      rrule: 'FREQ=DAILY;INTERVAL=1',
    });

    await db.insert(schema.recurrenceRules).values({
      itemType: 'task',
      itemId: task.id,
      rrule: 'FREQ=DAILY;INTERVAL=1',
    });

    sendEmailMock.mockResolvedValue({ success: true });

    await sendAllDailyDigests();

    const [options] = sendEmailMock.mock.calls[0];
    expect(options.html).toContain('Daily Standup');
    expect(options.html).toContain('Recurring Task');
  });

  it('retries sendEmail failures with backoff', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await db.insert(schema.events).values({
      ...createTestEvent({
        userId: TEST_USER_ID,
        title: 'Retry Event',
        startAt: new Date('2026-02-01T14:00:00Z'),
        endAt: new Date('2026-02-01T15:00:00Z'),
      }),
    });

    sendEmailMock
      .mockResolvedValueOnce({ success: false, error: 'temporary' })
      .mockResolvedValueOnce({ success: true });

    const resultPromise = sendAllDailyDigests();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      usersProcessed: 1,
      emailsSent: 1,
      emailsFailed: 0,
    });
  });
});
