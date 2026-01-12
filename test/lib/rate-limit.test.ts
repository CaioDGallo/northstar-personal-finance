import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ratelimitInstances = vi.hoisted(() => [] as Array<{ opts: { prefix: string }; limit: ReturnType<typeof vi.fn> }>);
const limitResponses = vi.hoisted(() => new Map<string, { success: boolean; reset: number }>());
const headersMock = vi.hoisted(() => vi.fn());

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({ mocked: true })),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = vi.fn((...args: unknown[]) => ({ type: 'slidingWindow', args }));
    limit: ReturnType<typeof vi.fn>;
    opts: { prefix: string };

    constructor(opts: { prefix: string }) {
      this.opts = opts;
      this.limit = vi.fn(async () => {
        return limitResponses.get(opts.prefix) ?? { success: true, reset: Date.now() + 60_000 };
      });
      ratelimitInstances.push(this);
    }
  }

  return { Ratelimit };
});

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

const setRedisEnv = (enabled: boolean) => {
  if (enabled) {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  } else {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
};

const loadModule = async () => await import('@/lib/rate-limit');

describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules();
    ratelimitInstances.length = 0;
    limitResponses.clear();
    headersMock.mockReset();
    setRedisEnv(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests when redis is not configured', async () => {
    const { checkLoginRateLimit, checkBulkRateLimit, checkPasswordResetRateLimit } = await loadModule();

    await expect(checkLoginRateLimit()).resolves.toEqual({ allowed: true });
    await expect(checkBulkRateLimit('user-1')).resolves.toEqual({ allowed: true });
    await expect(checkPasswordResetRateLimit()).resolves.toEqual({ allowed: true });

    expect(ratelimitInstances).toHaveLength(0);
  });

  it('extracts client IP from forwarded headers', async () => {
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }));
    const { getClientIP } = await loadModule();

    await expect(getClientIP()).resolves.toBe('1.1.1.1');
  });

  it('falls back to localhost when no IP headers are present', async () => {
    headersMock.mockResolvedValue(new Headers());
    const { getClientIP } = await loadModule();

    await expect(getClientIP()).resolves.toBe('127.0.0.1');
  });

  it('returns retryAfter when login rate limit is exceeded', async () => {
    setRedisEnv(true);
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '9.9.9.9' }));

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));
    limitResponses.set('rl:login', { success: false, reset: Date.now() + 5_000 });

    const { checkLoginRateLimit } = await loadModule();
    await expect(checkLoginRateLimit()).resolves.toEqual({ allowed: false, retryAfter: 5 });
  });

  it('uses the userId for bulk rate limiting', async () => {
    setRedisEnv(true);
    const { checkBulkRateLimit } = await loadModule();

    await checkBulkRateLimit('user-123');

    const bulkInstance = ratelimitInstances.find(instance => instance.opts.prefix === 'rl:bulk');
    expect(bulkInstance?.limit).toHaveBeenCalledWith('user-123');
  });
});
