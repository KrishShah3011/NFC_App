import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Avatar } from '@/components/CardRow';
import { Button, Screen, T } from '@/components/ui';
import { captureCard, consumeTrustedScan, type NewCard } from '@/lib/capture';
import { fetchProfile, pickFields } from '@/lib/data';
import { SLUG_RE } from '@/lib/qr';
import { findDuplicate } from '@/lib/search';
import { useData } from '@/lib/store';
import { emptyFields } from '@/lib/types';

// Reached by in-app scan, system camera, NFC tap, or any link (the OS dispatches it to the app).
// Only the in-app scanner saves instantly; links from anywhere else ask for one tap, so a web page
// can't silently add cards and phone contacts (drive-by contact injection).
export default function Receive() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { cards, events, slug: mine } = useData();
  const [preview, setPreview] = useState<NewCard | null>(null);
  const started = useRef(false);

  const save = (base: NewCard) => {
    const id = captureCard(base, events, { skipPhone: !!base.pending }); // no blank phone contact for pending cards
    router.replace(`/quick/${id}`);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const trusted = consumeTrustedScan(slug ?? '');
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
      if (trusted) save(base);
      else setPreview(base);
    })();
  }, [slug, cards, events, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!preview) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading card" />
      </View>
    );
  }
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 24 }}>
        <Avatar name={preview.name} uri={preview.photoUrl || undefined} size={80} />
        <T size={22} bold>
          {preview.pending ? 'Card details load when you are online' : preview.name}
        </T>
        {!!(preview.title || preview.company) && <T muted>{[preview.title, preview.company].filter(Boolean).join(' · ')}</T>}
      </View>
      <Button title="Save card" onPress={() => save(preview)} />
      <Button kind="secondary" title="Cancel" onPress={() => router.replace('/')} />
    </Screen>
  );
}
