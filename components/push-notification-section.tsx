'use client';

import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/lib/hooks/use-push-notifications';
import { getUserDevices } from '@/lib/actions/push-notifications';
import { Field, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

type Device = {
  id: number;
  deviceName: string | null;
  createdAt: Date | null;
  lastUsedAt: Date | null;
};

export function PushNotificationSection() {
  const { state, requestPermission, disable } = usePushNotifications();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const t = useTranslations('preferences.push');

  // Load devices when notifications are enabled
  useEffect(() => {
    if (state === 'granted') {
      void loadDevices();
    }
  }, [state]);

  const loadDevices = async () => {
    const result = await getUserDevices();
    if (result.success && result.devices) {
      setDevices(result.devices);
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const result = await requestPermission();
      if (result.success) {
        await loadDevices();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      await disable();
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: number) => {
    try {
      const { removeDevice } = await import('@/lib/actions/push-notifications');
      const result = await removeDevice(deviceId);
      if (result.success) {
        await loadDevices();
      }
    } catch (error) {
      console.error('Error removing device:', error);
    }
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    setTestMessage(null);
    try {
      const response = await fetch('/api/test-push', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        setTestMessage({ type: 'success', text: t('testSuccess') });
      } else {
        // Show the specific error message from the API
        setTestMessage({ type: 'error', text: result.error || t('testError') });
      }

      // Clear message after 5 seconds for errors (more time to read)
      setTimeout(() => setTestMessage(null), result.success ? 3000 : 5000);
    } catch (error) {
      console.error('Error sending test notification:', error);
      setTestMessage({ type: 'error', text: t('testError') });
      setTimeout(() => setTestMessage(null), 5000);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>{t('label')}</FieldLabel>
        <p className="text-sm text-muted-foreground mb-3">{t('description')}</p>

        {/* State-specific UI */}
        {state === 'loading' && (
          <div className="text-sm text-muted-foreground">Loading...</div>
        )}

        {state === 'unsupported' && (
          <div className="text-sm text-muted-foreground">
            {t('unsupported')}
          </div>
        )}

        {state === 'ios-not-pwa' && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">{t('iosNotPwa')}</p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">{t('iosNotPwaHelp')}</p>
          </div>
        )}

        {state === 'ios-unsupported' && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-100">
            {t('iosUnsupported')}
          </div>
        )}

        {state === 'denied' && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm">
            <p className="font-medium text-red-900 dark:text-red-100">{t('denied')}</p>
            <p className="text-red-700 dark:text-red-300 mt-1">{t('deniedHelp')}</p>
          </div>
        )}

        {state === 'prompt' && (
          <Button onClick={handleEnable} disabled={isLoading}>
            {isLoading ? 'Loading...' : t('enable')}
          </Button>
        )}

        {state === 'granted' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                {t('enabled')} ✓
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisable}
                disabled={isLoading}
              >
                {t('disable')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                disabled={testLoading}
              >
                {testLoading ? 'Sending...' : t('testNotification')}
              </Button>
            </div>

            {testMessage && (
              <div className={`rounded-md p-2 text-sm ${
                testMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
              }`}>
                {testMessage.text}
              </div>
            )}

            {/* Device list */}
            {devices.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">{t('devices')}</h4>
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{device.deviceName || 'Unknown Device'}</p>
                        <p className="text-xs text-muted-foreground">
                          Last used: {device.lastUsedAt
                            ? new Date(device.lastUsedAt).toLocaleDateString()
                            : device.createdAt
                            ? new Date(device.createdAt).toLocaleDateString()
                            : 'Unknown'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemoveDevice(device.id)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                        <span className="sr-only">{t('removeDevice')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {devices.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noDevices')}</p>
            )}
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
            An error occurred. Please try again.
          </div>
        )}
      </Field>
    </div>
  );
}
