'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { accounts, type NewAccount } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';

const ACCOUNT_TYPES = new Set(['credit_card', 'checking', 'savings', 'cash']);

async function validateAccountName(name: unknown) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new Error(await t('errors.accountNameRequired'));
  }
  return trimmed;
}

async function validateAccountType(type: unknown) {
  if (!ACCOUNT_TYPES.has(type as string)) {
    throw new Error(await t('errors.invalidAccountType'));
  }
}

async function validateBillingDay(day: unknown, errorKey: string) {
  if (day === null || day === undefined) {
    return;
  }
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    throw new Error(await t(errorKey));
  }
}

export const getAccounts = cache(async () => {
  const userId = await getCurrentUserId();
  return await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.name);
});

// Internal function for use by cached helpers (can't call getCurrentUserId inside unstable_cache)
export async function getAccountsByUser(userId: string) {
  return await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.name);
}

export async function createAccount(data: Omit<NewAccount, 'id' | 'userId' | 'createdAt'>) {
  const name = await validateAccountName(data.name);
  await validateAccountType(data.type);
  await validateBillingDay(data.closingDay, 'errors.invalidClosingDay');
  await validateBillingDay(data.paymentDueDay, 'errors.invalidPaymentDueDay');

  const userId = await getCurrentUserId();
  await db.insert(accounts).values({ ...data, name, userId });
  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}

export async function updateAccount(id: number, data: Partial<Omit<NewAccount, 'id' | 'userId' | 'createdAt'>>) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  const updates = { ...data };

  if (updates.name !== undefined) {
    updates.name = await validateAccountName(updates.name);
  }
  if (updates.type !== undefined) {
    await validateAccountType(updates.type);
  }
  if (updates.closingDay !== undefined) {
    await validateBillingDay(updates.closingDay, 'errors.invalidClosingDay');
  }
  if (updates.paymentDueDay !== undefined) {
    await validateBillingDay(updates.paymentDueDay, 'errors.invalidPaymentDueDay');
  }

  const userId = await getCurrentUserId();
  await db.update(accounts).set(updates).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}

export async function deleteAccount(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  const userId = await getCurrentUserId();
  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}
