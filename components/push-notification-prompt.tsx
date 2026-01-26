'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/lib/hooks/use-push-notifications';
import { shouldPromptPushNotifications, markPushNotificationPrompted } from '@/lib/actions/push-notifications';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Notification03Icon, Loading03Icon } from '@hugeicons/core-free-icons';

/**
 * Auto-prompt component for push notifications after onboarding completion
 * Shows once on dashboard if:
 * - User completed onboarding
 * - Never been prompted before
 * - Browser permission is 'default' (not asked yet)
 */
export function PushNotificationPrompt() {
  const { state, requestPermission } = usePushNotifications();
  const [shouldShow, setShouldShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const t = useTranslations('push.prompt');

  useEffect(() => {
    // Only check server-side flag after client state is ready
    if (state === 'loading') return;

    // Don't show if already granted, denied, or unsupported
    if (state !== 'prompt') {
      return;
    }

    // Check if we should prompt
    void shouldPromptPushNotifications().then((result) => {
      if (result.success && result.shouldPrompt) {
        setShouldShow(true);
      }
    });
  }, [state]);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, error: 'Timeout' }), 10000)
      );

      const result = await Promise.race([requestPermission(), timeoutPromise]);

      // Always mark as prompted
      await markPushNotificationPrompted();
      setShouldShow(false);

      if (!result.success) {
        console.error('Enable failed:', result.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async () => {
    // Mark as prompted so we don't show again
    await markPushNotificationPrompted();
    setIsDismissed(true);
    setShouldShow(false);
  };

  if (!shouldShow || isDismissed) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <HugeiconsIcon icon={Notification03Icon} className="size-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
            {t('title')}
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            {t('description')}
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" aria-hidden="true" />
                  {t('enabling')}
                </span>
              ) : (
                t('enable')
              )}
            </Button>
            <Button
              onClick={handleDismiss}
              disabled={isLoading}
              variant="ghost"
              size="sm"
              className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 dark:text-blue-300 dark:hover:text-blue-100 dark:hover:bg-blue-900"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" aria-hidden="true" />
              {t('dismiss')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
