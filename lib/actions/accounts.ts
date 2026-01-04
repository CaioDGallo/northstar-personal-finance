'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { accounts, type NewAccount } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';

export const getAccounts = cache(async () => {
  const userId = await getCurrentUserId();
  return await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.name);
});

// Internal function for use by cached helpers (can't call getCurrentUserId inside unstable_cache)
export async function getAccountsByUser(userId: string) {
  return await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.name);
}

export async function createAccount(data: Omit<NewAccount, 'id' | 'userId' | 'createdAt'>) {
  const userId = await getCurrentUserId();
  await db.insert(accounts).values({ ...data, userId });
  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}

export async function updateAccount(id: number, data: Partial<Omit<NewAccount, 'id' | 'userId' | 'createdAt'>>) {
  const userId = await getCurrentUserId();
  await db.update(accounts).set(data).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}

export async function deleteAccount(id: number) {
  const userId = await getCurrentUserId();
  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}
