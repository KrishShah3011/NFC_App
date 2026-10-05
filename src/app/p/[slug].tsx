import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { captureCard, type NewCard } from '@/lib/capture';
import { fetchProfile, pickFields } from '@/lib/data';
import { SLUG_RE } from '@/lib/qr';
import { findDuplicate } from '@/lib/search';
import { useData } from '@/lib/store';
import { emptyFields } from '@/lib/types';

// Reached by in-app scan, system camera, or NFC tap (OS dispatches the link to the app).
export default function Receive() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { cards, events, slug: mine } = useData();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      if (!slug || !SLUG_RE.test(slug) || slug === mine) return router.replace('/');
      const dup = findDuplicate(cards, { profileSlug: slug, phones: [], emails: [] });
      if (dup) return router.replace({ pathname: '/card/[id]', params: { id: dup.id, already: '1' } });
      let base: NewCard;
      try {
        const p = await fetchProfile(slug);
        if (!p) {
          Alert.alert('Card not found', 'This card is no longer shared.');
          return router.replace('/');
        }
        base = { ...pickFields(p), photoUrl: p.photoUrl, profileUpdatedAt: p.updatedAt, source: 'app', profileSlug: slug };
      } catch {
        base = { ...emptyFields(), source: 'app', profileSlug: slug, pending: true }; // offline: resolved on reconnect
      }
      const id = captureCard(base, events, { skipPhone: !!base.pending }); // no blank phone contact for pending cards
      router.replace(`/quick/${id}`);
    })();
  }, [slug, cards, events, mine]);

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <ActivityIndicator accessibilityLabel="Saving card" />
    </View>
  );
}
