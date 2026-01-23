'use server';

import { db } from '@/lib/db';
import { userSettings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { cache } from 'react';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Check if user has completed or skipped onboarding
 */
export const getOnboardingStatus = cache(async () => {
  try {
    const userId = await getCurrentUserId();
    const [settings] = await db
      .select({
        onboardingCompletedAt: userSettings.onboardingCompletedAt,
        onboardingSkippedAt: userSettings.onboardingSkippedAt,
        hintsViewed: userSettings.hintsViewed,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      return {
        needsOnboarding: true,
        hintsViewed: [] as string[],
      };
    }

    const hintsViewed = settings.hintsViewed
      ? (JSON.parse(settings.hintsViewed) as string[])
      : [];

    return {
      needsOnboarding: !settings.onboardingCompletedAt && !settings.onboardingSkippedAt,
      hintsViewed,
    };
  } catch (error) {
    console.error('[onboarding:getStatus] Failed:', error);
    return {
      needsOnboarding: false,
      hintsViewed: [] as string[],
    };
  }
});

/**
 * Mark onboarding as completed
 */
export async function completeOnboarding(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(userSettings)
      .set({
        onboardingCompletedAt: new Date(),
        onboardingSkippedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('[onboarding:complete] Failed:', error);
    return { success: false, error: 'Failed to complete onboarding' };
  }
}

/**
 * Mark onboarding as skipped
 */
export async function skipOnboarding(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(userSettings)
      .set({
        onboardingSkippedAt: new Date(),
        onboardingCompletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('[onboarding:skip] Failed:', error);
    return { success: false, error: 'Failed to skip onboarding' };
  }
}

/**
 * Mark a hint as viewed
 */
export async function markHintViewed(hintKey: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    const [settings] = await db
      .select({ hintsViewed: userSettings.hintsViewed })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const hintsViewed = settings?.hintsViewed
      ? (JSON.parse(settings.hintsViewed) as string[])
      : [];

    if (!hintsViewed.includes(hintKey)) {
      hintsViewed.push(hintKey);

      await db
        .update(userSettings)
        .set({
          hintsViewed: JSON.stringify(hintsViewed),
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('[onboarding:markHintViewed] Failed:', error);
    return { success: false, error: 'Failed to mark hint as viewed' };
  }
}

/**
 * Reset onboarding status (for testing/debugging)
 */
export async function resetOnboarding(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(userSettings)
      .set({
        onboardingCompletedAt: null,
        onboardingSkippedAt: null,
        hintsViewed: JSON.stringify([]),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('[onboarding:reset] Failed:', error);
    return { success: false, error: 'Failed to reset onboarding' };
  }
}
