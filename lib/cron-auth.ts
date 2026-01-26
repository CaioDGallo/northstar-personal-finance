/**
 * Cron authentication helpers
 *
 * Defense-in-depth: Even though API routes check CRON_SECRET,
 * server actions should also verify they're being called from a cron context.
 */

import { headers } from 'next/headers';

export async function requireCronAuth(): Promise<void> {
  const isAuthorized = await isCronContext();
  if (!isAuthorized) {
    throw new Error('Unauthorized: This function can only be called from authorized cron jobs');
  }
}

export async function isCronContext(): Promise<boolean> {
  const h = await headers();

  // Check if called from our cron API route (which validates CRON_SECRET)
  const cronHeader = h.get('authorization');
  if (cronHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // Allow in development/test environments with explicit bypass
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const bypassHeader = h.get('x-cron-bypass');
    if (bypassHeader === 'true') {
      return true;
    }
  }

  return false;
}
