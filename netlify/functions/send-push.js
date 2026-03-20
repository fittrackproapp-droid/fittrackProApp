const webpush = require('web-push');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

webpush.setVapidDetails(
  'mailto:your@email.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // Handle CORS preflight — Android WebView sends this before the real POST
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const { subscription, nativeFcmToken, title, body } = JSON.parse(event.body);

    if (nativeFcmToken) {
      await admin.messaging().send({
        token: nativeFcmToken,
        notification: { title, body },
        android: { priority: 'high', notification: { sound: 'default' } }
      });
    } else if (subscription) {
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('Push error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};