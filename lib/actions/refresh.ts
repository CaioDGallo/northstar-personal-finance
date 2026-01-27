'use server';

import { revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';

export async function refreshUserData() {
  const userId = await getCurrentUserId();
  revalidateTag(`user-${userId}`, {});
}
