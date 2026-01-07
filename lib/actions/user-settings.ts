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
  try {
    const userId = await getCurrentUserId();
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return settings;
  } catch (error) {
    console.error('[user-settings:get] Failed:', error);
    return undefined;
  }
});

export async function getOrCreateUserSettings() {
  try {
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
  } catch (error) {
    console.error('[user-settings:getOrCreate] Failed:', error);
    return undefined;
  }
}

function isValidTimezone(tz: string): boolean {
  try {
    const validTimezones = Intl.supportedValuesOf('timeZone');
    return validTimezones.includes(tz);
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function updateUserSettings(data: Partial<Omit<NewUserSettings, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Validate timezone if provided
    if (data.timezone !== undefined && data.timezone !== null && !isValidTimezone(data.timezone)) {
      return { success: false, error: await t('errors.invalidTimezone') };
    }

    // Validate notification email if provided
    if (data.notificationEmail !== undefined && data.notificationEmail !== null && !isValidEmail(data.notificationEmail)) {
      return { success: false, error: await t('errors.invalidEmail') };
    }

    // Validate default event offset minutes (0-10080 = 1 week)
    if (data.defaultEventOffsetMinutes !== undefined && data.defaultEventOffsetMinutes !== null) {
      if (data.defaultEventOffsetMinutes < 0 || data.defaultEventOffsetMinutes > 10080) {
        return { success: false, error: await t('errors.invalidOffsetMinutes') };
      }
    }

    // Validate default task offset minutes (0-10080 = 1 week)
    if (data.defaultTaskOffsetMinutes !== undefined && data.defaultTaskOffsetMinutes !== null) {
      if (data.defaultTaskOffsetMinutes < 0 || data.defaultTaskOffsetMinutes > 10080) {
        return { success: false, error: await t('errors.invalidOffsetMinutes') };
      }
    }

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