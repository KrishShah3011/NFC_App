import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { CardRow } from '@/components/CardRow';
import { Button, Screen, T, useNow } from '@/components/ui';
import { updateCard, updateEvent } from '@/lib/data';
import { useData } from '@/lib/store';
import { endOfDay, fmtDate, startOfDay } from '@/lib/time';

const endEventNow = (id: string) => updateEvent(id, { endsAt: Date.now() });

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, events } = useData();
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const now = useNow();
  const e = events.find((x) => x.id === id);
  if (!e) {
    return (
      <Screen>
        <T>Event not found.</T>
      </Screen>
    );
  }
  const active = e.startsAt <= now && now < e.endsAt;
  const inEvent = cards.filter((c) => c.eventId === id);
  // Retroactive add: cards met on the event's day(s) that aren't in it yet (spec §7.6).
  const candidates = cards.filter((c) => c.eventId !== id && c.metAt >= startOfDay(e.startsAt) && c.metAt < endOfDay(Math.min(e.endsAt - 1, now)));
  const toggle = (cid: string) => setSel((s) => (s.includes(cid) ? s.filter((x) => x !== cid) : [...s, cid]));

  return (
    <Screen>
      <Stack.Screen options={{ title: e.name }} />
      <T muted>
        {fmtDate(e.startsAt)}
        {e.placeLabel ? ` · ${e.placeLabel}` : ''}
        {active ? ' · Active' : ''}
      </T>
      {active && <Button kind="secondary" title="End event now" onPress={() => endEventNow(e.id)} />}
      <T bold>{inEvent.length} cards</T>
      {inEvent.map((c) => (
        <CardRow key={c.id} card={c} onPress={() => router.push(`/card/${c.id}`)} />
      ))}
      {!adding ? (
        <Button title="Add cards from that day" onPress={() => setAdding(true)} disabled={!candidates.length} />
      ) : (
        <>
          {candidates.map((c) => (
            <CardRow key={c.id} card={c} selected={sel.includes(c.id)} onPress={() => toggle(c.id)} />
          ))}
          <Button
            title={`Add ${sel.length} card${sel.length === 1 ? '' : 's'}`}
            disabled={!sel.length}
            onPress={() => {
              sel.forEach((cid) => updateCard(cid, { eventId: e.id }));
              setSel([]);
              setAdding(false);
            }}
          />
        </>
      )}
    </Screen>
  );
}
