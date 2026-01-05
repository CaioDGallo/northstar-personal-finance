import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

let redis: Redis | null = null;
let loginLimiter: Ratelimit | null = null;
let bulkLimiter: Ratelimit | null = null;
let passwordResetLimiter: Ratelimit | null = null;

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

function getLoginLimiter(): Ratelimit {
  if (!loginLimiter) {
    loginLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:login',
    });
  }
  return loginLimiter;
}

function getBulkLimiter(): Ratelimit {
  if (!bulkLimiter) {
    bulkLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:bulk',
    });
  }
  return bulkLimiter;
}

function getPasswordResetLimiter(): Ratelimit {
  if (!passwordResetLimiter) {
    passwordResetLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '1 m'),
      prefix: 'rl:pwreset',
    });
  }
  return passwordResetLimiter;
}

export async function getClientIP(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    h.get('x-real-ip') ||
    h.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

export async function checkLoginRateLimit(): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return { allowed: true };
  const ip = await getClientIP();
  const { success, reset } = await getLoginLimiter().limit(ip);
  if (success) return { allowed: true };
  return { allowed: false, retryAfter: Math.ceil((reset - Date.now()) / 1000) };
}

export async function checkBulkRateLimit(userId: string): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return { allowed: true };
  const { success, reset } = await getBulkLimiter().limit(userId);
  if (success) return { allowed: true };
  return { allowed: false, retryAfter: Math.ceil((reset - Date.now()) / 1000) };
}

export async function checkPasswordResetRateLimit(): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return { allowed: true };
  const ip = await getClientIP();
  const { success, reset } = await getPasswordResetLimiter().limit(ip);
  if (success) return { allowed: true };
  return { allowed: false, retryAfter: Math.ceil((reset - Date.now()) / 1000) };
}
