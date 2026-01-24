'use client';

import { useEffect, useState, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseConfig, VAPID_KEY } from '@/lib/firebase/config';
import { registerFcmToken, disableAllPushNotifications } from '@/lib/actions/push-notifications';

type PushState = 'loading' | 'unsupported' | 'prompt' | 'denied' | 'granted' | 'error' | 'ios-not-pwa' | 'ios-unsupported';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  const initializeMessagingImpl = useCallback(async () => {
    console.log('[Push] Starting initialization...');

    // Initialize Firebase app
    let app: FirebaseApp;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('[Push] Firebase app initialized');
    } else {
      app = getApps()[0];
      console.log('[Push] Using existing Firebase app');
    }

    // Get messaging instance
    const messagingInstance = getMessaging(app);
    console.log('[Push] Messaging instance created');

    // Wait for service worker to be ready
    console.log('[Push] Waiting for service worker...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[Push] Service worker ready:', registration);

    // Get FCM token
    console.log('[Push] Requesting FCM token...');
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    console.log('[Push] Token received:', token ? 'Success' : 'Failed');

    if (token) {
      setCurrentToken(token);

      // Get device name
      const deviceName = getDeviceName();

      // Register token with backend
      await registerFcmToken(token, deviceName);

      // Listen for foreground messages
      onMessage(messagingInstance, (payload) => {
        console.log('Foreground message received:', payload);

        // Show notification manually in foreground
        if (payload.notification) {
          new Notification(payload.notification.title || 'fluxo.sh', {
            body: payload.notification.body,
            icon: '/brand-kit/exports/icon-192-dark.png',
            tag: payload.data?.tag || 'default',
          });
        }
      });
    }
  }, []);

  const initializeMessaging = useCallback(async () => {
    const timeoutMs = 15000; // 15 second timeout

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Initialization timeout')), timeoutMs)
    );

    try {
      await Promise.race([
        initializeMessagingImpl(),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Error initializing messaging:', error);
      setState('error');
    }
  }, [initializeMessagingImpl]);

  useEffect(() => {
    // Compute the state based on browser capabilities and permissions
    let newState: PushState;
    let shouldInitialize = false;

    // Check if push notifications are supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      newState = 'unsupported';
    } else if (!('serviceWorker' in navigator)) {
      newState = 'unsupported';
    } else {
      // Detect iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as { standalone?: boolean }).standalone === true;

      if (isIOS) {
        // iOS requires PWA to be installed
        if (!isStandalone) {
          newState = 'ios-not-pwa';
        } else {
          // Check iOS version (iOS 16.4+ required for web push)
          const match = navigator.userAgent.match(/OS (\d+)_/);
          const version = match ? parseInt(match[1], 10) : 0;
          if (version < 16) {
            newState = 'ios-unsupported';
          } else {
            // iOS 16.4+ in PWA mode - check permission
            const permission = Notification.permission;
            if (permission === 'denied') {
              newState = 'denied';
            } else if (permission === 'granted') {
              newState = 'granted';
              shouldInitialize = true;
            } else {
              newState = 'prompt';
            }
          }
        }
      } else {
        // Non-iOS: Check current permission state
        const permission = Notification.permission;
        if (permission === 'denied') {
          newState = 'denied';
        } else if (permission === 'granted') {
          newState = 'granted';
          shouldInitialize = true;
        } else {
          newState = 'prompt';
        }
      }
    }

    // Update state once (initialization pattern - checking browser capabilities on mount)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(newState);

    // Initialize messaging if needed
    if (shouldInitialize) {
      void initializeMessaging();
    }
  }, [initializeMessaging]);

  const requestPermission = async () => {
    if (state === 'unsupported' || state === 'denied' || state === 'ios-not-pwa' || state === 'ios-unsupported') {
      return { success: false, error: 'Permission denied or unsupported' };
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        setState('granted');

        // Fire and forget - don't block UI
        void initializeMessaging().catch(console.error);

        return { success: true };
      } else {
        setState('denied');
        return { success: false, error: 'Permission denied' };
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      setState('error');
      return { success: false, error: 'Failed to request permission' };
    }
  };

  const disable = async () => {
    try {
      // Use server action that doesn't need token
      const result = await disableAllPushNotifications();
      if (result.success) {
        setCurrentToken(null);
        setState('prompt');
      }
      return result;
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      return { success: false, error: 'Failed to disable notifications' };
    }
  };

  return {
    state,
    requestPermission,
    disable,
  };
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}
