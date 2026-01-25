import { messaging } from '@/lib/firebase/admin';
import { db } from '@/lib/db';
import { fcmTokens } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!messaging) {
    console.error('Firebase messaging not initialized');
    return { sent: 0, failed: 0 };
  }

  // Get all user's FCM tokens
  const tokens = await db
    .select()
    .from(fcmTokens)
    .where(eq(fcmTokens.userId, userId));

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Send to each device
  for (const tokenRecord of tokens) {
    try {
      await messaging.send({
        token: tokenRecord.token,
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/dashboard',
          tag: payload.tag || 'default',
          type: payload.type || 'default',
        },
        webpush: {
          fcmOptions: {
            link: payload.url || '/dashboard',
          },
        },
      });
      sent++;

      // Update lastUsedAt
      await db
        .update(fcmTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(fcmTokens.id, tokenRecord.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      failed++;

      // Clean up invalid tokens (expired, unregistered, etc.)
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await db
          .delete(fcmTokens)
          .where(eq(fcmTokens.id, tokenRecord.id));
      }
    }
  }

  return { sent, failed };
}

export async function sendBroadcastPush(
  payload: PushNotificationPayload,
  userFilter?: { pushEnabled: true }
): Promise<{ sent: number; failed: number }> {
  if (!messaging) {
    console.error('Firebase messaging not initialized');
    return { sent: 0, failed: 0 };
  }

  // Get all tokens (optionally filtered by user settings)
  // This is a simple implementation - for large scale, use Firebase batch messaging
  let allTokens;

  if (userFilter?.pushEnabled) {
    // Join with userSettings to filter
    allTokens = await db
      .select({ token: fcmTokens.token, tokenId: fcmTokens.id })
      .from(fcmTokens)
      .innerJoin(
        (await import('@/lib/schema')).userSettings,
        eq(fcmTokens.userId, (await import('@/lib/schema')).userSettings.userId)
      )
      .where(eq((await import('@/lib/schema')).userSettings.pushNotificationsEnabled, true));
  } else {
    allTokens = await db
      .select({ token: fcmTokens.token, tokenId: fcmTokens.id })
      .from(fcmTokens);
  }

  let sent = 0;
  let failed = 0;

  for (const tokenRecord of allTokens) {
    try {
      await messaging.send({
        token: tokenRecord.token,
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/dashboard',
          tag: payload.tag || 'default',
          type: payload.type || 'default',
        },
        webpush: {
          fcmOptions: {
            link: payload.url || '/dashboard',
          },
        },
      });
      sent++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      failed++;

      // Clean up invalid tokens
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await db
          .delete(fcmTokens)
          .where(eq(fcmTokens.id, tokenRecord.tokenId));
      }
    }
  }

  return { sent, failed };
}
