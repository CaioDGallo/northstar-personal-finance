import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logError, logEvent, logForDebugging, logWarning } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('logs error details with context', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Boom');

    logError(ErrorIds.EVENT_CREATE_FAILED, 'Failed to create event', error, { eventId: 123 });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const errorData = consoleError.mock.calls[0][4] as {
      errorId: string;
      message: string;
      timestamp: string;
      context: Record<string, unknown>;
      error: { message: string; name: string };
    };

    expect(errorData.errorId).toBe(ErrorIds.EVENT_CREATE_FAILED);
    expect(errorData.message).toBe('Failed to create event');
    expect(errorData.context).toEqual({ eventId: 123 });
    expect(errorData.error.message).toBe('Boom');
    expect(new Date(errorData.timestamp).toISOString()).toBe(errorData.timestamp);
  });

  it('logs debug output only in development', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';

    logForDebugging('events:get', 'Fetching events', { userId: 'abc' });

    expect(consoleLog).toHaveBeenCalledWith('[DEBUG] [events:get]', 'Fetching events', { userId: 'abc' });
  });

  it('suppresses debug output outside development', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';

    logForDebugging('events:get', 'Fetching events', { userId: 'abc' });

    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('logs analytics events only in development', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';

    logEvent('event_created', { eventType: 'meeting' });

    expect(consoleLog).toHaveBeenCalled();
    expect(consoleLog.mock.calls[0][0]).toBe('[ANALYTICS]');
  });

  it('always logs warnings', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logWarning('calendar-sync', 'Slow sync', { sourceId: 1 });

    expect(consoleWarn).toHaveBeenCalled();
    expect(consoleWarn.mock.calls[0][0]).toContain('[WARN]');
  });
});
