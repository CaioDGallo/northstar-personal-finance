import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/schema';
import { sendPushToUser } from '@/lib/services/push-sender';
import { defaultLocale, locales, type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { eq } from 'drizzle-orm';

/**
 * POST /api/test-push
 * Sends a test push notification to the current user's devices
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const userId = await getCurrentUserId();

    const [settings] = await db
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const locale = locales.includes(settings?.locale as Locale)
      ? (settings?.locale as Locale)
      : defaultLocale;

    // Send test notification
    const result = await sendPushToUser(userId, {
      title: translateWithLocale(locale, 'push.test.title'),
      body: translateWithLocale(locale, 'push.test.body'),
      url: '/settings/preferences',
      tag: 'test',
      type: 'test',
    });

    if (result.sent > 0) {
      return NextResponse.json({
        success: true,
        sent: result.sent,
        failed: result.failed,
      });
    } else if (result.failed > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send notifications to all devices. They may be invalid or expired.',
        },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'No devices registered. Please enable push notifications first in Settings.',
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('[test-push] Error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
