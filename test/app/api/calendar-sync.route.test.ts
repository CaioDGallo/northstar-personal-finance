import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const syncCalendarSource = vi.fn();
const syncAllCalendars = vi.fn();
const getCurrentUserId = vi.fn();

vi.mock('@/lib/actions/calendar-sync', () => ({ syncCalendarSource, syncAllCalendars }));
vi.mock('@/lib/auth', () => ({ getCurrentUserId }));

let POST: typeof import('@/app/api/calendar-sync/route').POST;

describe('POST /api/calendar-sync', () => {
  beforeAll(async () => {
    ({ POST } = await import('@/app/api/calendar-sync/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserId.mockResolvedValue('test-user');
  });

  it('syncs a single calendar source when calendarSourceId is provided', async () => {
    syncCalendarSource.mockResolvedValue({ success: true, created: 1, updated: 0 });

    const request = new Request('http://localhost/api/calendar-sync', {
      method: 'POST',
      body: JSON.stringify({ calendarSourceId: 123 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(getCurrentUserId).toHaveBeenCalled();
    expect(syncCalendarSource).toHaveBeenCalledWith(123);
    expect(syncAllCalendars).not.toHaveBeenCalled();
    expect(body).toEqual({ success: true, created: 1, updated: 0 });
  });

  it('syncs all calendars when no calendarSourceId is provided', async () => {
    syncAllCalendars.mockResolvedValue([
      { success: true },
      { success: false },
      { success: true },
    ]);

    const request = new Request('http://localhost/api/calendar-sync', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(getCurrentUserId).toHaveBeenCalled();
    expect(syncCalendarSource).not.toHaveBeenCalled();
    expect(syncAllCalendars).toHaveBeenCalled();
    expect(body).toEqual({
      success: true,
      results: [{ success: true }, { success: false }, { success: true }],
      total: 3,
      successful: 2,
    });
  });

  it('returns 500 when sync throws', async () => {
    syncAllCalendars.mockRejectedValue(new Error('fail'));

    const request = new Request('http://localhost/api/calendar-sync', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
