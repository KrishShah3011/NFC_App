import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { initializeAppCheck, ReactNativeFirebaseAppCheckProvider } from '@react-native-firebase/app-check';
import { getAuth } from '@react-native-firebase/auth';
import { CACHE_SIZE_UNLIMITED, initializeFirestore } from '@react-native-firebase/firestore';
import { getFunctions } from '@react-native-firebase/functions';
import { getStorage } from '@react-native-firebase/storage';

const app = getApp();

const appCheckProvider = new ReactNativeFirebaseAppCheckProvider();
appCheckProvider.configure({
  android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
  apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
});
void initializeAppCheck(app, { provider: appCheckProvider, isTokenAutoRefreshEnabled: true });

export const auth = getAuth(app);
// Unlimited cache: every card stays on device; local search depends on it (spec §9).
export const db = initializeFirestore(app, { persistence: true, cacheSizeBytes: CACHE_SIZE_UNLIMITED, ignoreUndefinedProperties: true });
export const storage = getStorage(app);
export const BUCKET = app.options.storageBucket ?? '';
export const functions = getFunctions(app, 'asia-south1');

const analytics = getAnalytics(app);
export const track = (name: string, params?: Record<string, string | number>) => {
  try {
    logEvent(analytics, name, params);
  } catch {
    // analytics must never break a user flow
  }
};
