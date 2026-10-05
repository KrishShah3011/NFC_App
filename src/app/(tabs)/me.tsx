import { signOut } from '@react-native-firebase/auth';
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Platform, Switch, View } from 'react-native';
import { toVCard } from '../../../hosting/vcard.js';
import { Avatar } from '@/components/CardRow';
import { Button, Screen, T, useTheme } from '@/components/ui';
import { LINK_DOMAIN } from '@/lib/config';
import { contextLine, saveMyCardToPhone } from '@/lib/contacts';
import { deleteAccount } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { clearLocal, writeLocal } from '@/lib/local';
import { useData } from '@/lib/store';
import type { Settings } from '@/lib/types';

const GUIDE = Platform.select({
  ios: [
    '1. Tap "Save my card to Contacts" below.',
    '2. Open Settings › Apps › Contacts › My Information and pick that card.',
    '3. Hold the top of your iPhone near another iPhone. NameDrop sends your card.',
  ],
  default: [
    '1. Open Settings › Google › Quick Share › Tap to Share.',
    '2. Set up your contact card with the same details as your profile.',
    '3. Hold the tops of both phones together to share.',
  ],
});

export default function Me() {
  const { profile, cards, events, local } = useData();
  const t = useTheme();
  const { guide } = useLocalSearchParams<{ guide?: string }>();
  const [showGuide, setShowGuide] = useState(!!guide);
  const [busy, setBusy] = useState(false);

  const setting = (k: keyof Settings) => (v: boolean) => {
    writeLocal({ settings: { ...local.settings, [k]: v } });
  };

  // Free export: data-access right + no lock-in (spec §12).
  const exportAll = async () => {
    const file = new File(Paths.cache, 'cards.vcf');
    file.create({ overwrite: true });
    file.write(
      cards
        .map((c) => toVCard({ ...c, note: [contextLine(c, events.find((e) => e.id === c.eventId)?.name), c.notes].filter(Boolean).join('\n') }))
        .join(''),
    );
    await Sharing.shareAsync(file.uri, { mimeType: 'text/vcard', UTI: 'public.vcard', dialogTitle: 'Export cards' });
  };

  const endSession = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    await signOut(auth).catch(() => {});
    clearLocal();
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your cards stay in your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: endSession },
    ]);

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your profile, every saved card, your events and photos. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
            await endSession();
          } catch {
            Alert.alert('Could not delete your account', 'Check your connection and try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  if (!profile) return null;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: t.card }}>
        <Avatar name={profile.name} uri={profile.photoUrl || undefined} size={64} />
        <View style={{ flex: 1 }}>
          <T size={20} bold>
            {profile.name}
          </T>
          {!!(profile.title || profile.company) && <T muted>{[profile.title, profile.company].filter(Boolean).join(' · ')}</T>}
          <T muted size={13}>
            {profile.phones[0] ?? profile.emails[0] ?? ''}
          </T>
        </View>
      </View>
      <Button kind="secondary" title="Edit profile" onPress={() => router.push('/profile-edit')} />

      <Button kind="secondary" title={showGuide ? 'Hide tap-to-share setup' : 'Set up NameDrop / Tap to Share'} onPress={() => setShowGuide((x) => !x)} />
      {showGuide && (
        <View style={{ gap: 6 }}>
          {GUIDE.map((line) => (
            <T key={line}>{line}</T>
          ))}
          {Platform.OS === 'ios' && (
            <Button
              title="Save my card to Contacts"
              onPress={async () => Alert.alert((await saveMyCardToPhone(profile)) ? 'Saved. Now pick it in Settings.' : 'Contacts permission is needed')}
            />
          )}
        </View>
      )}

      <T bold>Settings</T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T>Save new cards to phone Contacts</T>
        <Switch value={local.settings.saveToContacts} onValueChange={setting('saveToContacts')} accessibilityLabel="Save new cards to phone Contacts" />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T>Remember where I met people</T>
        <Switch value={local.settings.location} onValueChange={setting('location')} accessibilityLabel="Remember where I met people" />
      </View>

      <Button kind="secondary" title={`Export all cards (${cards.length}) as .vcf`} onPress={exportAll} disabled={!cards.length} />
      <Button kind="secondary" title="Privacy policy" onPress={() => Linking.openURL(`https://${LINK_DOMAIN}/privacy`)} />
      <Button kind="secondary" title="Terms of service" onPress={() => Linking.openURL(`https://${LINK_DOMAIN}/terms`)} />
      <Button kind="secondary" title="Sign out" onPress={confirmSignOut} />
      <Button kind="danger" title={busy ? 'Deleting…' : 'Delete account'} onPress={confirmDelete} disabled={busy} />
    </Screen>
  );
}
