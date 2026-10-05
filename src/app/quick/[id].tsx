import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Field, Screen, splitList, T, useNow } from '@/components/ui';
import { updateCard } from '@/lib/data';
import { useData } from '@/lib/store';
import { fmtDate } from '@/lib/time';

export default function QuickSave() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, events, local } = useData();
  const card = cards.find((c) => c.id === id);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const now = useNow();
  const latest = useRef({ notes, tags });
  useEffect(() => {
    latest.current = { notes, tags };
  }, [notes, tags]);

  // The card is already saved. Swiping the sheet away keeps it, and whatever was typed is saved on close (spec §8).
  useEffect(
    () => () => {
      const n = latest.current.notes.trim();
      const tg = splitList(latest.current.tags.toLowerCase());
      if (n || tg.length) updateCard(id, { notes: n, tags: tg });
    },
    [id],
  );

  const event = events.find((e) => e.id === card?.eventId);
  const place = card?.place?.label ?? (card?.place ? 'Location saved' : local.settings.location ? 'Locating…' : 'Location off');
  const time = new Date(card?.metAt ?? now).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return (
    <Screen>
      <T size={20} bold>
        {card?.pending ? 'Saved. Details load when you are online.' : `Saved ${card?.name || 'card'}`}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
        <Chip label={`${fmtDate(card?.metAt ?? now)} ${time}`} />
        <Chip label={place} />
        {event && <Chip label={event.name} />}
      </View>
      <Field label="Note" placeholder="e.g. wants a quote for 5k units" value={notes} onChangeText={setNotes} multiline />
      <Field label="Tags (comma separated)" placeholder="vendor, investor" value={tags} onChangeText={setTags} autoCapitalize="none" />
      <Button title="Done" onPress={() => router.back()} />
    </Screen>
  );
}
