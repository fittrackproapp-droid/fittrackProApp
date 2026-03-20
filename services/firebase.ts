import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { Capacitor } from "@capacitor/core";

// --- MIGRATION INSTRUCTIONS ---
// 1. Log into your NEW Google Account at https://console.firebase.google.com/
// 2. Create a new project.
// 3. Go to Project Settings -> General -> "Your apps" -> Click the Web icon (</>) -> Register app.
// 4. Copy the "firebaseConfig" object values and paste them below.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = !!firebaseConfig.apiKey;

if (!isConfigured) {
  console.warn(
    "⚠️ FIREBASE NOT CONFIGURED: Using placeholder config. Database operations will fail or mock.",
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
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
