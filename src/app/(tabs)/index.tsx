import * as Brightness from 'expo-brightness';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Screen, T, useNow, useTheme } from '@/components/ui';
import { profileLink } from '@/lib/config';
import { track } from '@/lib/firebase';
import { writeTag } from '@/lib/nfc';
import { useData } from '@/lib/store';
import { activeEvent } from '@/lib/time';

// Rendered from cached profile data: no network wait, works offline (spec §8).
export default function ShareScreen() {
  const { profile, slug, events } = useData();
  const t = useTheme();
  const link = profileLink(slug ?? '');
  const now = useNow();
  const event = activeEvent(events, now);

  useFocusEffect(
    useCallback(() => {
      let prev: number | undefined;
      Brightness.getBrightnessAsync()
        .then((b) => {
          prev = b;
          return Brightness.setBrightnessAsync(1);
        })
        .catch(() => {});
      track('qr_shown');
      return () => {
        if (prev !== undefined) Brightness.setBrightnessAsync(prev).catch(() => {});
      };
    }, []),
  );

  if (!profile || !slug) return null;

  const nfc = async () => {
    const r = await writeTag(link);
    if (r === 'written') {
      track('nfc_written');
      Alert.alert('Tag written', 'Anyone who taps it gets your card.');
    } else if (r !== 'cancelled') Alert.alert('NFC', r.error);
  };

  return (
    <Screen scroll={false}>
      {event && (
        <View style={{ padding: 10, borderRadius: 10, backgroundColor: t.card }}>
          <T>At {event.name}</T>
        </View>
      )}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <View accessible accessibilityLabel={`QR code for ${profile.name}'s card`} style={{ padding: 16, backgroundColor: '#fff', borderRadius: 16 }}>
          <QRCode value={link} size={260} ecl="M" />
        </View>
        <T size={22} bold>
          {profile.name}
        </T>
        {!!(profile.title || profile.company) && <T muted>{[profile.title, profile.company].filter(Boolean).join(' · ')}</T>}
      </View>
      <View style={{ gap: 10 }}>
        <Button kind="secondary" title="Write NFC tag" onPress={nfc} />
        <Button title="Send link" onPress={() => Share.share({ message: `${profile.name}: my contact card ${link}` })} />
      </View>
    </Screen>
  );
}
