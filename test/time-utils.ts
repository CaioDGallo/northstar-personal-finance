import { vi } from 'vitest';

type TimeInput = string | Date;

export function freezeTime(date: TimeInput) {
  const target = typeof date === 'string' ? new Date(date) : date;
  vi.useFakeTimers();
  vi.setSystemTime(target);
  return target;
}

export function resetTime() {
  vi.useRealTimers();
}

export async function withTimezone<T>(timeZone: string, fn: () => T | Promise<T>) {
  const previousTz = process.env.TZ;
  process.env.TZ = timeZone;

  try {
    return await fn();
  } finally {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  }
}
