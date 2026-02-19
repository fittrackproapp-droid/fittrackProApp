import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';

// --- MIGRATION INSTRUCTIONS ---
// 1. Log into your NEW Google Account at https://console.firebase.google.com/
// 2. Create a new project.
// 3. Go to Project Settings -> General -> "Your apps" -> Click the Web icon (</>) -> Register app.
// 4. Copy the "firebaseConfig" object values and paste them below.

const firebaseConfig = {
  apiKey: 'AIzaSyDfckfb6JVXNGnY-0a1xL80_oTrueQwjRQ',
  authDomain: 'fittrack-pro-app-be182.firebaseapp.com',
  projectId: 'fittrack-pro-app-be182',
  storageBucket: 'fittrack-pro-app-be182.firebasestorage.app',
  messagingSenderId: '888756758530',
  appId: '1:888756758530:web:c10f5645e57b28bf8a1f1b',
};

const isConfigured = firebaseConfig.apiKey !== 'PASTE_YOUR_NEW_API_KEY_HERE';

if (!isConfigured) {
  console.warn(
    '⚠️ FIREBASE NOT CONFIGURED: Using placeholder config. Database operations will fail or mock.',
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const dbFirestore = getFirestore(app);
export const storage = getStorage(app);
export const isFirebaseConfigured = isConfigured;

// Firebase Web Messaging only works in a browser with a service worker.
// On native Android, push notifications are handled by @capacitor/push-notifications
// (see capacitor-notifications.ts) which uses the native FCM SDK under the hood.
export const messaging =
  isConfigured && !Capacitor.isNativePlatform() ? getMessaging(app) : null;

// VAPID key is only used by the web push path.
export const VAPID_KEY =
  'BIQMIWKD4pRBzH4wu_bRuXi9tcqrWtzTdLYZ1eB_q8nlGZl0MT_i3tHR8yDXjegry1AbUYEwXEYWgqpp-T4C6sg';