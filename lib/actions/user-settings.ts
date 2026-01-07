'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { userSettings, type NewUserSettings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';

type ActionResult = { success: true } | { success: false; error: string };

export const getUserSettings = cache(async () => {
  const userId = await getCurrentUserId();
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  
  return settings;
});

export async function getOrCreateUserSettings() {
  const userId = await getCurrentUserId();
  let [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  
  if (!settings) {
    [settings] = await db
      .insert(userSettings)
      .values({ userId })
      .returning();
  }
  
  return settings;
}

export async function updateUserSettings(data: Partial<Omit<NewUserSettings, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    
    await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
    
    revalidatePath('/settings');
    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error('[user-settings:update] Failed:', error);
    return { success: false, error: await t('errors.failedToUpdate') };
  }
}