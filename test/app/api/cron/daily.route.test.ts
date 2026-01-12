import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';

const processPendingNotificationJobs = vi.fn();
const reconcileAllAccountBalances = vi.fn();
const updatePastItemStatuses = vi.fn();
const syncAllUsersCalendars = vi.fn();
const sendAllDailyDigests = vi.fn();

vi.mock('@/lib/actions/notification-jobs', () => ({ processPendingNotificationJobs }));
vi.mock('@/lib/actions/accounts', () => ({ reconcileAllAccountBalances }));
vi.mock('@/lib/actions/status-updates', () => ({ updatePastItemStatuses }));
vi.mock('@/lib/actions/calendar-sync', () => ({ syncAllUsersCalendars }));
vi.mock('@/lib/actions/daily-digest', () => ({ sendAllDailyDigests }));

let GET: typeof import('@/app/api/cron/daily/route').GET;

describe('GET /api/cron/daily', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/cron/daily/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';

    processPendingNotificationJobs.mockResolvedValue({ processed: 1, failed: 0 });
    reconcileAllAccountBalances.mockResolvedValue({ updated: 2 });
    updatePastItemStatuses.mockResolvedValue({ eventsCompleted: 1, tasksMarkedOverdue: 1 });
    syncAllUsersCalendars.mockResolvedValue([{ success: true }]);
    sendAllDailyDigests.mockResolvedValue({ success: true, usersProcessed: 1, emailsSent: 1, emailsFailed: 0, errors: [] });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 401 when authorization header is invalid', async () => {
    const request = new Request('http://localhost/api/cron/daily', {
      headers: { authorization: 'Bearer wrong' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it.each([
    {
      job: 'notifications',
      called: {
        notifications: true,
        balance: false,
        status: false,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'status-updates',
      called: {
        notifications: false,
        balance: false,
        status: true,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'calendar-sync',
      called: {
        notifications: false,
        balance: false,
        status: false,
        calendar: true,
        digest: false,
      },
    },
    {
      job: 'balance-reconciliation',
      called: {
        notifications: false,
        balance: true,
        status: false,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'daily-digest',
      called: {
        notifications: false,
        balance: false,
        status: false,
        calendar: false,
        digest: true,
      },
    },
    {
      job: 'all',
      called: {
        notifications: true,
        balance: true,
        status: true,
        calendar: true,
        digest: true,
      },
    },
  ])('runs selected jobs for job=$job', async ({ job, called }) => {
    const request = new Request(`http://localhost/api/cron/daily?job=${job}`, {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(processPendingNotificationJobs).toHaveBeenCalledTimes(called.notifications ? 1 : 0);
    expect(reconcileAllAccountBalances).toHaveBeenCalledTimes(called.balance ? 1 : 0);
    expect(updatePastItemStatuses).toHaveBeenCalledTimes(called.status ? 1 : 0);
    expect(syncAllUsersCalendars).toHaveBeenCalledTimes(called.calendar ? 1 : 0);
    expect(sendAllDailyDigests).toHaveBeenCalledTimes(called.digest ? 1 : 0);

    expect(body.notifications).toEqual(called.notifications ? { processed: 1, failed: 0 } : null);
    expect(body.balanceReconciliation).toEqual(called.balance ? { updated: 2 } : null);
    expect(body.statusUpdates).toEqual(called.status ? { eventsCompleted: 1, tasksMarkedOverdue: 1 } : null);
    expect(body.calendarSync).toEqual(called.calendar ? [{ success: true }] : null);
    expect(body.dailyDigest).toEqual(
      called.digest ? { success: true, usersProcessed: 1, emailsSent: 1, emailsFailed: 0, errors: [] } : null
    );
  });

  it('returns 500 when a job throws', async () => {
    updatePastItemStatuses.mockRejectedValue(new Error('boom'));

    const request = new Request('http://localhost/api/cron/daily?job=status-updates', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
