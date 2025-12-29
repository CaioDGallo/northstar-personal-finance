'use server';

import { db } from '@/lib/db';
import { accounts, type NewAccount } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getAccounts() {
  return await db.select().from(accounts).orderBy(accounts.name);
}

export async function createAccount(data: Omit<NewAccount, 'id' | 'createdAt'>) {
  await db.insert(accounts).values(data);
  revalidatePath('/settings/accounts');
}

export async function updateAccount(id: number, data: Partial<Omit<NewAccount, 'id' | 'createdAt'>>) {
  await db.update(accounts).set(data).where(eq(accounts.id, id));
  revalidatePath('/settings/accounts');
}

export async function deleteAccount(id: number) {
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath('/settings/accounts');
}
