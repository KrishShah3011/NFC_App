import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { CardRow } from '@/components/CardRow';
import { DateField } from '@/components/DateField';
import { NativeAdRow, useAdsOn } from '@/components/NativeAdRow';
import { Banner, Button, Chip, T, useNow, useTheme } from '@/components/ui';
import { isAd, withAdSlots } from '@/lib/ads';
import { track } from '@/lib/firebase';
import { dueToday } from '@/lib/followups';
import { allTags, searchCards, type Filters } from '@/lib/search';
import { useData } from '@/lib/store';
import { DAY, fmtDate, startOfMonth, startOfWeek } from '@/lib/time';
import type { CardSource, Event } from '@/lib/types';

const SOURCES: [CardSource, string][] = [
  ['app', 'App'],
  ['paper', 'Paper'],
  ['contacts', 'Contacts'],
  ['manual', 'QR/other'],
];

export default function CardsTab() {
  const { cards, events, local, inboxEnabled } = useData();
  const t = useTheme();
  const adsOn = useAdsOn();
  const [seg, setSeg] = useState<'cards' | 'events'>('cards');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({});
  const [sheet, setSheet] = useState<null | 'event' | 'tag' | 'custom'>(null);
  const now = useNow();

  const results = useMemo(() => searchCards(cards, events, q, f), [cards, events, q, f]);
  const rows = withAdSlots(results, adsOn);
  const eventName = (id?: string) => events.find((e) => e.id === id)?.name;
  const due = dueToday(cards, now).length;
  const inboxCount = inboxEnabled ? local.inbox.pending.length : 0;
  const filter = (patch: Filters) => {
    setF((x) => ({ ...x, ...patch }));
    track('search_used');
  };
  const range = f.from === startOfWeek(now) && !f.to ? 'week' : f.from === startOfMonth(now) && !f.to ? 'month' : f.from || f.to ? 'custom' : null;

  const sortedEvents = [...events].sort((a, b) => Number(isActive(b, now)) - Number(isActive(a, now)) || b.startsAt - a.startsAt);
  const eventRows: (Event | { ad: true; key: string })[] = adsOn && sortedEvents.length ? [...sortedEvents, { ad: true, key: 'ad-events' }] : sortedEvents;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', marginVertical: 10 }}>
        <Chip label="Cards" active={seg === 'cards'} onPress={() => setSeg('cards')} />
        <Chip label="Events" active={seg === 'events'} onPress={() => setSeg('events')} />
      </View>

      {seg === 'cards' ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => (isAd(r) ? r.key : r.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 8, marginBottom: 8 }}>
              {inboxCount > 0 && <Banner text={`${inboxCount} new contact${inboxCount > 1 ? 's' : ''}: add context`} onPress={() => router.push('/inbox')} />}
              {due > 0 && <Banner text={`${due} follow-up${due > 1 ? 's' : ''} due today`} onPress={() => filter({ due: !f.due })} />}
              <TextInput
                accessibilityLabel="Search cards"
                placeholder="Search name, company, notes, event, place"
                placeholderTextColor={t.muted}
                value={q}
                onChangeText={setQ}
                onSubmitEditing={() => track('search_used')}
                style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, color: t.fg }}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip label={f.eventId ? (eventName(f.eventId) ?? 'Event') : 'Event'} active={!!f.eventId} onPress={() => setSheet('event')} />
                <Chip label={f.tag ? `#${f.tag}` : 'Tag'} active={!!f.tag} onPress={() => setSheet('tag')} />
                <Chip label="This week" active={range === 'week'} onPress={() => filter(range === 'week' ? { from: undefined, to: undefined } : { from: startOfWeek(now), to: undefined })} />
                <Chip label="This month" active={range === 'month'} onPress={() => filter(range === 'month' ? { from: undefined, to: undefined } : { from: startOfMonth(now), to: undefined })} />
                <Chip label="Custom dates" active={range === 'custom'} onPress={() => setSheet('custom')} />
                {SOURCES.map(([s, label]) => (
                  <Chip key={s} label={label} active={f.source === s} onPress={() => filter({ source: f.source === s ? undefined : s })} />
                ))}
                {f.due && <Chip label="Due today ✕" active onPress={() => filter({ due: false })} />}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={<T muted>{cards.length ? 'No cards match.' : 'No cards yet. Scan a QR code or a paper card to start.'}</T>}
          renderItem={({ item }) =>
            isAd(item) ? <NativeAdRow /> : <CardRow card={item} eventName={eventName(item.eventId)} onPress={() => router.push(`/card/${item.id}`)} />
          }
        />
      ) : (
        <FlatList
          data={eventRows}
          keyExtractor={(e) => ('ad' in e ? e.key : e.id)}
          ListHeaderComponent={
            <View style={{ marginBottom: 8 }}>
              <Button title="Start event" onPress={() => router.push('/event/new')} />
            </View>
          }
          ListEmptyComponent={<T muted>Start an event when you arrive at an expo. Every card you capture gets tagged with it.</T>}
          renderItem={({ item }) =>
            'ad' in item ? (
              <NativeAdRow />
            ) : (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/event/${item.id}`)} style={{ paddingVertical: 12 }}>
                <T bold>
                  {item.name}
                  {isActive(item, now) ? '  · Active' : ''}
                </T>
                <T muted size={13}>
                  {fmtDate(item.startsAt)} · {cards.filter((c) => c.eventId === item.id).length} cards
                </T>
              </Pressable>
            )
          }
        />
      )}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setSheet(null)} />
        <View style={{ backgroundColor: t.bg, padding: 16, gap: 8, maxHeight: '60%' }}>
          <ScrollView>
            {sheet === 'event' &&
              [{ id: '', name: 'Any event' }, ...events].map((e) => (
                <Chip key={e.id || 'any'} label={e.name} active={(f.eventId ?? '') === e.id} onPress={() => (filter({ eventId: e.id || undefined }), setSheet(null))} />
              ))}
            {sheet === 'tag' &&
              ['', ...allTags(cards)].map((tag) => (
                <Chip key={tag || 'any'} label={tag ? `#${tag}` : 'Any tag'} active={(f.tag ?? '') === tag} onPress={() => (filter({ tag: tag || undefined }), setSheet(null))} />
              ))}
            {sheet === 'custom' && (
              <View style={{ gap: 12 }}>
                <DateField label="From" value={f.from ?? now - 30 * DAY} onChange={(v) => filter({ from: v })} />
                <DateField label="To" value={f.to ?? now} onChange={(v) => filter({ to: v + DAY })} />
                <Button kind="secondary" title="Clear dates" onPress={() => (filter({ from: undefined, to: undefined }), setSheet(null))} />
                <Button title="Done" onPress={() => setSheet(null)} />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const isActive = (e: Event, now: number) => e.startsAt <= now && now < e.endsAt;
