import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting, type RouterAction } from 'expo-quick-actions/router';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { useAdsOn } from '@/components/NativeAdRow';
import { useTheme } from '@/components/ui';
import { DataProvider, useData } from '@/lib/store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
// Android 8+ needs a channel before any notification shows.
if (Platform.OS === 'android') {
  void Notifications.setNotificationChannelAsync('default', { name: 'Follow-up reminders', importance: Notifications.AndroidImportance.HIGH });
}

export default function RootLayout() {
  return (
    <DataProvider>
      <Gate />
    </DataProvider>
  );
}

function Gate() {
  const { ready, user, profile } = useData();
  const t = useTheme();
  const adsOn = useAdsOn();

  useQuickActionRouting();
  useEffect(() => {
    QuickActions.setItems<RouterAction>([
      { id: 'qr', title: 'Show my QR', params: { href: '/' } },
      { id: 'scan', title: 'Scan card', params: { href: '/scan' } },
    ]);
  }, []);

  // Tapping a follow-up reminder opens the card (spec §7.8).
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = last?.notification.request.content.data?.url;
    if (user && typeof url === 'string') router.push(url as never);
  }, [last, user]);

  // Consent form only shows where required (EEA/UK); then start the SDK (spec §4).
  useEffect(() => {
    if (!adsOn) return;
    AdsConsent.gatherConsent()
      .catch(() => {})
      .finally(() => void mobileAds().initialize());
  }, [adsOn]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile-edit" options={{ title: profile ? 'Edit profile' : 'Create your card' }} />
        <Stack.Screen name="quick/[id]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 1], headerShown: false }} />
        <Stack.Screen name="p/[slug]" options={{ title: 'Saving card' }} />
        <Stack.Screen name="card/[id]" options={{ title: '' }} />
        <Stack.Screen name="review" options={{ title: 'Check details' }} />
        <Stack.Screen name="event/new" options={{ title: 'Start event', presentation: 'modal' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="inbox" options={{ title: 'New contacts' }} />
      </Stack.Protected>
    </Stack>
  );
}
