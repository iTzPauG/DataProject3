import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  type Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firestoreDb: Firestore | null = firebaseApp
  ? initializeFirestore(firebaseApp, Platform.OS === 'web'
    ? {}
    : {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      })
  : null;

function _initAuth(app: ReturnType<typeof initializeApp>): Auth {
  // On web, use default getAuth (localStorage). On native, use AsyncStorage.
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  return initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export const firebaseAuth: Auth | null = firebaseApp ? _initAuth(firebaseApp) : null;