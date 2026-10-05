import type { ExpoConfig } from 'expo/config';

// Founder inputs (spec §18) — change here only. See docs/SETUP.md.
const APP_NAME = 'NFC App';
const BUNDLE_ID = 'com.krishshah.nfcapp';
const SCHEME = 'nfcapp';
const LINK_DOMAIN = process.env.LINK_DOMAIN ?? 'nfc-app-prod.web.app';
// Google's public sample AdMob app IDs; production IDs come from EAS env vars.
const ADMOB_ANDROID = process.env.ADMOB_APP_ID_ANDROID ?? 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_IOS = process.env.ADMOB_APP_ID_IOS ?? 'ca-app-pub-3940256099942544~1458002511';
const CONTACT_NOTES = process.env.CONTACT_NOTES === '1'; // set once Apple grants the entitlement

const config: ExpoConfig = {
  name: APP_NAME,
  slug: 'nfc-app',
  scheme: SCHEME,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${LINK_DOMAIN}`],
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
    accessesContactNotes: CONTACT_NOTES,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: BUNDLE_ID,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [{ scheme: 'https', host: LINK_DOMAIN, pathPrefix: '/p/' }],
      },
    ],
  },
  plugins: [
    'expo-router',
    ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/crashlytics',
    '@react-native-firebase/app-check',
    '@react-native-google-signin/google-signin',
    'expo-apple-authentication',
    ['expo-camera', { cameraPermission: 'Scan QR codes and paper visiting cards.', recordAudioAndroid: false }],
    ['expo-contacts', { contactsPermission: 'Save cards to your Contacts and organise contacts you receive.' }],
    ['expo-location', { locationWhenInUsePermission: 'Remember where you met someone when you save their card.' }],
    [
      'expo-image-picker',
      { photosPermission: 'Pick a photo of a visiting card or your profile photo.', cameraPermission: 'Photograph your visiting card.' },
    ],
    'expo-notifications',
    ['react-native-nfc-manager', { nfcPermission: 'Write your card link to an NFC tag.', includeNdefEntitlement: true }],
    ['react-native-google-mobile-ads', { androidAppId: ADMOB_ANDROID, iosAppId: ADMOB_IOS }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    linkDomain: LINK_DOMAIN,
    scheme: SCHEME,
    contactNotes: CONTACT_NOTES,
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
    adUnitNativeAndroid: process.env.ADMOB_NATIVE_ANDROID ?? '',
    adUnitNativeIos: process.env.ADMOB_NATIVE_IOS ?? '',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
