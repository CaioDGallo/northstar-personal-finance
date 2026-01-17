import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { createTestBillReminder, TEST_USER_ID } from '@/test/fixtures';
import { eq, and } from 'drizzle-orm';

type BillReminderActions = typeof import('@/lib/actions/bill-reminders');
type BillReminderJobs = typeof import('@/lib/actions/bill-reminder-jobs');
type NotificationJobs = typeof import('@/lib/actions/notification-jobs');

describe('Bill Reminders - CRUD Operations', () => {
  let db: ReturnType<typeof getTestDb>;
  let reminderId: number;

  let getBillReminders: BillReminderActions['getBillReminders'];
  let createBillReminder: BillReminderActions['createBillReminder'];
  let updateBillReminder: BillReminderActions['updateBillReminder'];
  let deleteBillReminder: BillReminderActions['deleteBillReminder'];
  let acknowledgeBillReminder: BillReminderActions['acknowledgeBillReminder'];

  const tMock = vi.fn(async (key: string) => key);

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    mockAuth();

    vi.doMock('@/lib/i18n/server-errors', () => ({
      t: tMock,
      translateWithLocale: vi.fn(async (_locale: string, key: string) => key),
    }));

    const getUserSettingsMock = vi.fn().mockResolvedValue({
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
    });
    vi.doMock('@/lib/actions/user-settings', () => ({
      getUserSettings: getUserSettingsMock,
    }));

    const actions = await import('@/lib/actions/bill-reminders');
    getBillReminders = actions.getBillReminders;
    createBillReminder = actions.createBillReminder;
    updateBillReminder = actions.updateBillReminder;
    deleteBillReminder = actions.deleteBillReminder;
    acknowledgeBillReminder = actions.acknowledgeBillReminder;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    const [reminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ name: 'Internet Bill' }))
      .returning();

    reminderId = reminder.id;
  });

  it('getBillReminders returns user reminders', async () => {
    await db.insert(schema.billReminders).values([
      createTestBillReminder({ name: 'Electricity', userId: TEST_USER_ID }),
      createTestBillReminder({ name: 'Water', userId: 'other-user' }),
    ]);

    const reminders = await getBillReminders();
    expect(reminders.map((r) => r.name)).toEqual(['Electricity', 'Internet Bill']);
  });

  it('createBillReminder validates name required', async () => {
    const result = await createBillReminder({
      name: '',
      dueDay: 15,
      startMonth: '2026-01',
    });

    expect(result).toEqual({
      success: false,
      error: 'errors.nameRequired',
    });
  });

  it('createBillReminder validates dueDay range for monthly', async () => {
    const result = await createBillReminder({
      name: 'Test',
      dueDay: 32,
      startMonth: '2026-01',
      recurrenceType: 'monthly',
    });

    expect(result).toEqual({
      success: false,
      error: 'errors.invalidDueDay',
    });
  });

  it('createBillReminder validates dueDay range for weekly', async () => {
    const result = await createBillReminder({
      name: 'Test',
      dueDay: 7,
      startMonth: '2026-01',
      recurrenceType: 'weekly',
    });

    expect(result).toEqual({
      success: false,
      error: 'errors.invalidDueDay',
    });
  });

  it('createBillReminder creates valid reminder', async () => {
    const result = await createBillReminder({
      name: 'New Bill',
      dueDay: 5,
      startMonth: '2026-02',
      amount: 15000,
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBeDefined();

    const [created] = await db
      .select()
      .from(schema.billReminders)
      .where(eq(schema.billReminders.id, result.data!.id));

    expect(created).toMatchObject({
      userId: TEST_USER_ID,
      name: 'New Bill',
      dueDay: 5,
      startMonth: '2026-02',
      amount: 15000,
      status: 'active',
    });
  });

  it('updateBillReminder partial updates', async () => {
    const result = await updateBillReminder(reminderId, {
      name: 'Updated Internet',
      amount: 20000,
    });

    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.billReminders)
      .where(eq(schema.billReminders.id, reminderId));

    expect(updated.name).toBe('Updated Internet');
    expect(updated.amount).toBe(20000);
    expect(updated.dueDay).toBe(15); // Unchanged
  });

  it('updateBillReminder respects user isolation', async () => {
    const [otherReminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ userId: 'other-user' }))
      .returning();

    await updateBillReminder(otherReminder.id, { name: 'Hacked' });

    const [unchanged] = await db
      .select()
      .from(schema.billReminders)
      .where(eq(schema.billReminders.id, otherReminder.id));

    expect(unchanged.name).not.toBe('Hacked');
  });

  it('deleteBillReminder removes reminder', async () => {
    const result = await deleteBillReminder(reminderId);
    expect(result).toEqual({ success: true });

    const remaining = await db
      .select()
      .from(schema.billReminders)
      .where(eq(schema.billReminders.id, reminderId));

    expect(remaining).toHaveLength(0);
  });

  it('deleteBillReminder respects user isolation', async () => {
    const [otherReminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ userId: 'other-user' }))
      .returning();

    await deleteBillReminder(otherReminder.id);

    const remaining = await db
      .select()
      .from(schema.billReminders)
      .where(eq(schema.billReminders.id, otherReminder.id));

    expect(remaining).toHaveLength(1);
  });

  it('acknowledgeBillReminder updates lastAcknowledgedMonth', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T10:00:00Z'));

    const result = await acknowledgeBillReminder(reminderId);
    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.billReminders)
      .where(eq(schema.billReminders.id, reminderId));

    // Timezone is America/Sao_Paulo (UTC-3), so 2026-02-15 10:00 UTC = 2026-02-15 07:00 local
    expect(updated.lastAcknowledgedMonth).toBe('2026-02');

    vi.useRealTimers();
  });
});

describe('Bill Reminders - Scheduling', () => {
  let db: ReturnType<typeof getTestDb>;
  let scheduleBillReminderNotifications: BillReminderJobs['scheduleBillReminderNotifications'];

  beforeAll(async () => {
    db = await setupTestDb();
    vi.doMock('@/lib/db', () => ({ db }));

    const jobs = await import('@/lib/actions/bill-reminder-jobs');
    scheduleBillReminderNotifications = jobs.scheduleBillReminderNotifications;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates jobs for reminders due within 7 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'));

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      timezone: 'UTC',
    });

    // Reminder due on Feb 15 (5 days away)
    await db.insert(schema.billReminders).values(
      createTestBillReminder({
        dueDay: 15,
        startMonth: '2026-02',
      })
    );

    const result = await scheduleBillReminderNotifications();

    expect(result.scheduled).toBe(3); // 2 days before, 1 day before, on due day

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(3);

    const scheduledDates = jobs.map((j) => j.scheduledAt.toISOString());
    expect(scheduledDates).toContain('2026-02-13T00:00:00.000Z'); // 2 days before
    expect(scheduledDates).toContain('2026-02-14T00:00:00.000Z'); // 1 day before
    expect(scheduledDates).toContain('2026-02-15T00:00:00.000Z'); // on due day
  });

  it('respects notify flags', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'));

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      timezone: 'UTC',
    });

    // Only notify 1 day before
    await db.insert(schema.billReminders).values(
      createTestBillReminder({
        dueDay: 15,
        startMonth: '2026-02',
        notify2DaysBefore: false,
        notify1DayBefore: true,
        notifyOnDueDay: false,
      })
    );

    await scheduleBillReminderNotifications();

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.scheduledAt.toISOString()).toBe('2026-02-14T00:00:00.000Z');
  });

  it('uses user timezone for scheduledAt calculation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'));

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      timezone: 'America/New_York', // UTC-5
    });

    // Due day 15 in New York timezone
    await db.insert(schema.billReminders).values(
      createTestBillReminder({
        dueDay: 15,
        startMonth: '2026-02',
        notify2DaysBefore: false,
        notify1DayBefore: false,
        notifyOnDueDay: true,
      })
    );

    await scheduleBillReminderNotifications();

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(1);
    // Feb 15 00:00 in New York = Feb 15 05:00 UTC
    expect(jobs[0]?.scheduledAt.toISOString()).toBe('2026-02-15T05:00:00.000Z');
  });

  it('idempotency - skips existing pending jobs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'));

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      timezone: 'UTC',
    });

    const [reminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ dueDay: 15, startMonth: '2026-02' }))
      .returning();

    // First run
    await scheduleBillReminderNotifications();
    const firstCount = await db.select().from(schema.notificationJobs);
    expect(firstCount).toHaveLength(3);

    // Second run - should skip existing jobs
    const result = await scheduleBillReminderNotifications();
    expect(result.skipped).toBe(3);

    const secondCount = await db.select().from(schema.notificationJobs);
    expect(secondCount).toHaveLength(3); // No duplicates
  });

  it('24-hour grace window for past times', async () => {
    vi.useFakeTimers();
    // Current time: Feb 15 12:00 (noon)
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      timezone: 'UTC',
    });

    // Reminder due today (already passed midnight but within 24h grace)
    await db.insert(schema.billReminders).values(
      createTestBillReminder({
        dueDay: 15,
        startMonth: '2026-02',
        notify2DaysBefore: false,
        notify1DayBefore: false,
        notifyOnDueDay: true,
      })
    );

    await scheduleBillReminderNotifications();

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(1); // Still scheduled despite being in the past
  });
});

describe('Bill Reminders - Notification Processing', () => {
  let db: ReturnType<typeof getTestDb>;
  let processPendingNotificationJobs: NotificationJobs['processPendingNotificationJobs'];
  let fetchMock: ReturnType<typeof vi.fn>;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    db = await setupTestDb();
    vi.doMock('@/lib/db', () => ({ db }));

    vi.doMock('@/lib/i18n/server-errors', () => ({
      translateWithLocale: vi.fn((locale: string, key: string, params?: any) => {
        if (key === 'emails.billReminders.subject') {
          return `Bill Reminders for ${params?.date || 'date'}`;
        }
        if (key === 'emails.billReminder.subject') {
          return `Bill Reminder: ${params?.name || 'name'}`;
        }
        return key;
      }),
    }));

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
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups jobs by user + date for single email', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [reminder1] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ name: 'Electric Bill', dueDay: 15 }))
      .returning();

    const [reminder2] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ name: 'Water Bill', dueDay: 16 }))
      .returning();

    // Two jobs on same day for same user
    await db.insert(schema.notificationJobs).values([
      {
        itemType: 'bill_reminder',
        itemId: reminder1.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
        status: 'pending',
        attempts: 0,
      },
      {
        itemType: 'bill_reminder',
        itemId: reminder2.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T14:00:00Z'),
        status: 'pending',
        attempts: 0,
      },
    ]);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await processPendingNotificationJobs();

    // Both jobs processed
    expect(result.processed).toBe(2);

    // Only one email sent (grouped)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify the email contains both reminders
    const emailCall = fetchMock.mock.calls[0]?.[1];
    const emailBody = JSON.parse(emailCall?.body || '{}');
    expect(emailBody.html).toContain('Electric Bill');
    expect(emailBody.html).toContain('Water Bill');
  });

  it('uses grouped template for multiple reminders', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [reminder1] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ name: 'Reminder 1' }))
      .returning();

    const [reminder2] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ name: 'Reminder 2' }))
      .returning();

    await db.insert(schema.notificationJobs).values([
      {
        itemType: 'bill_reminder',
        itemId: reminder1.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
        status: 'pending',
        attempts: 0,
      },
      {
        itemType: 'bill_reminder',
        itemId: reminder2.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
        status: 'pending',
        attempts: 0,
      },
    ]);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await processPendingNotificationJobs();

    const emailCall = fetchMock.mock.calls[0]?.[1];
    const emailBody = JSON.parse(emailCall?.body || '{}');

    // Grouped template should mention "Bill Reminders" plural
    expect(emailBody.subject).toContain('Bill Reminders');
  });

  it('cancels job when reminder inactive', async () => {
    const [reminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder({ status: 'paused' }))
      .returning();

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'bill_reminder',
        itemId: reminder.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
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
    expect(updated.lastError).toContain('no longer active');
  });

  it('fails when no notificationEmail', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: null, // No email configured
      timezone: 'UTC',
    });

    const [reminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder())
      .returning();

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'bill_reminder',
        itemId: reminder.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
        status: 'pending',
        attempts: 0,
      })
      .returning();

    const result = await processPendingNotificationJobs();

    expect(result.failed).toBe(1);

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    expect(updated.status).toBe('failed');
    expect(updated.lastError).toContain('not configured');
  });

  it('retry logic up to 3 attempts', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [reminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder())
      .returning();

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'bill_reminder',
        itemId: reminder.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
        status: 'pending',
        attempts: 2, // Already tried twice
      })
      .returning();

    // Fail the email send
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Send failed' }),
    });

    await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    // After 3rd attempt, should be marked as failed permanently
    expect(updated.status).toBe('failed');
    expect(updated.attempts).toBe(2); // Attempts not incremented after final failure
  });

  it('increments attempts below retry limit', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      timezone: 'UTC',
    });

    const [reminder] = await db
      .insert(schema.billReminders)
      .values(createTestBillReminder())
      .returning();

    const [job] = await db
      .insert(schema.notificationJobs)
      .values({
        itemType: 'bill_reminder',
        itemId: reminder.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-14T10:00:00Z'),
        status: 'pending',
        attempts: 1,
      })
      .returning();

    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Send failed' }),
    });

    await processPendingNotificationJobs();

    const [updated] = await db
      .select()
      .from(schema.notificationJobs)
      .where(eq(schema.notificationJobs.id, job.id));

    // Should still be pending with incremented attempts
    expect(updated.status).toBe('pending');
    expect(updated.attempts).toBe(2);
  });
});
