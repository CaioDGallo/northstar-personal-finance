import { headers } from 'next/headers';

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const loginStore: RateLimitStore = new Map();
const passwordResetStore: RateLimitStore = new Map();
const signupStore: RateLimitStore = new Map();
const bulkStore: RateLimitStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginStore) {
    if (value.resetAt < now) loginStore.delete(key);
  }
  for (const [key, value] of passwordResetStore) {
    if (value.resetAt < now) passwordResetStore.delete(key);
  }
  for (const [key, value] of signupStore) {
    if (value.resetAt < now) signupStore.delete(key);
  }
  for (const [key, value] of bulkStore) {
    if (value.resetAt < now) bulkStore.delete(key);
  }
}, 5 * 60 * 1000);

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

function checkLimit(
  store: RateLimitStore,
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  if (!record || record.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count++;
  return { allowed: true };
}

export async function checkLoginRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(loginStore, ip, 15, 60 * 1000); // 15 attempts per minute
}

export async function checkPasswordResetRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(passwordResetStore, ip, 3, 60 * 1000); // 3 attempts per minute
}

export async function checkSignupRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(signupStore, ip, 5, 60 * 1000); // 5 attempts per minute
}

export async function checkBulkRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(bulkStore, userId, 10, 60 * 1000); // 10 attempts per minute
}
