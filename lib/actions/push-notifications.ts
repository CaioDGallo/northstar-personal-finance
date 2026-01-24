'use server';

import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { fcmTokens, userSettings } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export async function registerFcmToken(token: string, deviceName?: string) {
  const userId = await getCurrentUserId();

  try {
    // Upsert token (update if exists, insert if new)
    const existingToken = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.token, token))
      .limit(1);

    if (existingToken.length > 0) {
      // Update existing token
      await db
        .update(fcmTokens)
        .set({
          userId: userId,
          deviceName,
          lastUsedAt: new Date(),
        })
        .where(eq(fcmTokens.token, token));
    } else {
      // Insert new token
      await db.insert(fcmTokens).values({
        userId: userId,
        token,
        deviceName,
      });
    }

    // Enable push notifications in user settings
    await db
      .update(userSettings)
      .set({ pushNotificationsEnabled: true })
      .where(eq(userSettings.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return { success: false, error: 'Failed to register token' };
  }
}

export async function unregisterFcmToken(token: string) {
  const userId = await getCurrentUserId();

  try {
    // Delete the token
    await db
      .delete(fcmTokens)
      .where(and(eq(fcmTokens.token, token), eq(fcmTokens.userId, userId)));

    // Check if user has any remaining tokens
    const remainingTokens = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId));

    // If no tokens left, disable push notifications
    if (remainingTokens.length === 0) {
      await db
        .update(userSettings)
        .set({ pushNotificationsEnabled: false })
        .where(eq(userSettings.userId, userId));
    }

    return { success: true };
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    return { success: false, error: 'Failed to unregister token' };
  }
}

export async function getUserDevices() {
  const userId = await getCurrentUserId();

  try {
    const devices = await db
      .select({
        id: fcmTokens.id,
        deviceName: fcmTokens.deviceName,
        createdAt: fcmTokens.createdAt,
        lastUsedAt: fcmTokens.lastUsedAt,
      })
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId))
      .orderBy(fcmTokens.lastUsedAt);

    return { success: true, devices };
  } catch (error) {
    console.error('Error fetching user devices:', error);
    return { success: false, error: 'Failed to fetch devices', devices: [] };
  }
}

export async function removeDevice(tokenId: number) {
  const userId = await getCurrentUserId();

  try {
    // Verify token belongs to user before deleting
    await db
      .delete(fcmTokens)
      .where(and(eq(fcmTokens.id, tokenId), eq(fcmTokens.userId, userId)));

    // Check if user has any remaining tokens
    const remainingTokens = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId));

    // If no tokens left, disable push notifications
    if (remainingTokens.length === 0) {
      await db
        .update(userSettings)
        .set({ pushNotificationsEnabled: false })
        .where(eq(userSettings.userId, userId));
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing device:', error);
    return { success: false, error: 'Failed to remove device' };
  }
}

export async function shouldPromptPushNotifications() {
  const userId = await getCurrentUserId();

  try {
    const [settings] = await db
      .select({
        onboardingCompletedAt: userSettings.onboardingCompletedAt,
        pushNotificationPromptedAt: userSettings.pushNotificationPromptedAt,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      return { success: true, shouldPrompt: false };
    }

    // Only prompt if onboarding completed and not prompted before
    const shouldPrompt =
      !!settings.onboardingCompletedAt &&
      !settings.pushNotificationPromptedAt;

    return { success: true, shouldPrompt };
  } catch (error) {
    console.error('Error checking if should prompt:', error);
    return { success: false, error: 'Failed to check prompt status', shouldPrompt: false };
  }
}

export async function markPushNotificationPrompted() {
  const userId = await getCurrentUserId();

  try {
    await db
      .update(userSettings)
      .set({ pushNotificationPromptedAt: new Date() })
      .where(eq(userSettings.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error marking push notification prompted:', error);
    return { success: false, error: 'Failed to mark as prompted' };
  }
}
