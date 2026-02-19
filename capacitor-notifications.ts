/**
 * capacitor-notifications.ts
 *
 * Handles push notification registration and listeners on native Android via
 * the @capacitor/push-notifications plugin. On web, the existing Firebase
 * Messaging / service-worker flow is used instead (see firebase.ts).
 */

import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  ActionPerformed,
  PushNotificationSchema,
} from '@capacitor/push-notifications';

export type NativePushToken = string;

/**
 * Call this once on app startup (e.g. inside App.tsx useEffect).
 * Returns the native FCM token so you can send it to your backend.
 * Resolves to null on web (use Firebase Messaging instead).
 */
export async function initNativePushNotifications(
  onToken: (token: NativePushToken) => void,
  onNotification?: (notification: PushNotificationSchema) => void,
  onNotificationTap?: (action: ActionPerformed) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web — handled by Firebase Messaging + service worker
    return;
  }

  // 1. Request permission
  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== 'granted') {
    console.warn('[Push] Permission not granted');
    return;
  }

  // 2. Register with FCM — triggers the 'registration' event below
  await PushNotifications.register();

  // 3. Listen for the FCM token
  PushNotifications.addListener('registration', (token: Token) => {
    console.log('[Push] FCM token:', token.value);
    onToken(token.value);
  });

  // 4. Registration errors
  PushNotifications.addListener('registrationError', (err) => {
    console.error('[Push] Registration error:', err.error);
  });

  // 5. Foreground notifications
  if (onNotification) {
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('[Push] Received:', notification);
        onNotification(notification);
      },
    );
  }

  // 6. User tapped a notification
  if (onNotificationTap) {
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('[Push] Action performed:', action);
        onNotificationTap(action);
      },
    );
  }
}

/**
 * Remove all push notification listeners (call on unmount / logout).
 */
export async function cleanupNativePushNotifications(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await PushNotifications.removeAllListeners();
  }
}
