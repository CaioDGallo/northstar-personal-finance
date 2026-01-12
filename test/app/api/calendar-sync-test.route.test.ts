import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const fetchICalUrl = vi.fn();
const parseICalendar = vi.fn();
const getCurrentUserId = vi.fn();

vi.mock('@/lib/ical/fetch', () => ({ fetchICalUrl }));
vi.mock('@/lib/ical/parser', () => ({ parseICalendar }));
vi.mock('@/lib/auth', () => ({ getCurrentUserId }));

let POST: typeof import('@/app/api/calendar-sync/test/route').POST;

describe('POST /api/calendar-sync/test', () => {
  beforeAll(async () => {
    ({ POST } = await import('@/app/api/calendar-sync/test/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserId.mockResolvedValue('test-user');
  });

  it('returns 400 when url is missing', async () => {
    const request = new Request('http://localhost/api/calendar-sync/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'URL is required' });
  });

  it('returns fetch error when fetchICalUrl fails', async () => {
    fetchICalUrl.mockResolvedValue({ success: false, error: 'Fetch failed' });

    const request = new Request('http://localhost/api/calendar-sync/test', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/calendar.ics' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(fetchICalUrl).toHaveBeenCalled();
    expect(body).toEqual({ success: false, error: 'Fetch failed' });
  });

  it('returns parse error when parseICalendar throws', async () => {
    fetchICalUrl.mockResolvedValue({ success: true, data: 'BEGIN:VCALENDAR' });
    parseICalendar.mockImplementation(() => {
      throw new Error('Parse failed');
    });

    const request = new Request('http://localhost/api/calendar-sync/test', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/calendar.ics' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body).toEqual({ success: false, error: 'Parse failed' });
  });

  it('returns calendar name and event count on success', async () => {
    fetchICalUrl.mockResolvedValue({ success: true, data: 'BEGIN:VCALENDAR' });
    parseICalendar.mockReturnValue({ name: 'Test Calendar', events: [{}, {}] });

    const request = new Request('http://localhost/api/calendar-sync/test', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/calendar.ics' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body).toEqual({
      success: true,
      calendarName: 'Test Calendar',
      eventCount: 2,
    });
  });
});
