const webpush = require('web-push');
const admin = require('firebase-admin');

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

webpush.setVapidDetails(
  'mailto:your@email.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { subscription, nativeFcmToken, title, body } = JSON.parse(event.body);

    if (nativeFcmToken) {
      // Native Android — use FCM
      await admin.messaging().send({
        token: nativeFcmToken,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: { sound: 'default' }
        }
      });
    } else if (subscription) {
      // Web browser — use web-push
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body })
      );
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Push error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};