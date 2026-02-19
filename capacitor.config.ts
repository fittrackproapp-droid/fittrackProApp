import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fittrackpro.app',
  appName: 'FitTrack Pro',
  webDir: 'dist',
  // Disable the built-in server on native — serve from bundled assets
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Native push notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Camera / video recording
    Camera: {
      // Request both camera and microphone permissions upfront
    },
    // Splash screen (optional, remove if not needed)
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6366f1', // Indigo — match your app theme
      showSpinner: false,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '888756758530-g5ka688msmf2qdkp2cqchsf5v0t49bsu.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
