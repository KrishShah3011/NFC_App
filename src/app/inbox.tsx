import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Screen, T, useTheme } from '@/components/ui';
import { captureCard } from '@/lib/capture';
import { inboxContactFields, requestFullContacts, resolveInbox } from '@/lib/contacts';
import { track } from '@/lib/firebase';
import { suggestEvents, type InboxItem } from '@/lib/inbox';
import { useData } from '@/lib/store';
import type { Fields } from '@/lib/types';

export default function Inbox() {
  const { local, events, inboxEnabled, refreshInbox } = useData();
  const t = useTheme();
  const [details, setDetails] = useState<Record<string, Fields>>({});
  const [choosing, setChoosing] = useState<string | null>(null);
  const pending = local.inbox.pending;

  useEffect(() => {
    for (const p of pending) {
      if (details[p.id]) continue;
      inboxContactFields(p.id)
        .then((f) => setDetails((d) => ({ ...d, [p.id]: f })))
        .catch(() => resolveInbox(p.id)); // contact was deleted
    }
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!inboxEnabled) {
    return (
      <Screen>
        <T>Contacts you receive by NameDrop, Tap to Share or WhatsApp show up here so you can note where you met.</T>
        <T muted>This needs full access to your contacts. Your address book never leaves your phone.</T>
        <Button
          title="Allow full contacts access"
          onPress={async () => {
            if ((await requestFullContacts()) === 'all') await refreshInbox();
          }}
        />
      </Screen>
    );
  }

  if (!pending.length) {
    return (
      <Screen>
        <T muted>No new contacts. Contacts you add by NameDrop, Tap to Share or WhatsApp appear here.</T>
      </Screen>
    );
  }

  const accept = (p: InboxItem, eventId: string | null) => {
    const f = details[p.id];
    if (!f) return;
    const id = captureCard({ ...f, source: 'contacts' }, events, { eventId, metAt: p.seenAt, skipPlace: true, skipPhone: true });
    resolveInbox(p.id, id);
    track('inbox_accepted');
    setChoosing(null);
    router.push(`/quick/${id}`);
  };

  return (
    <Screen>
      {pending.map((p) => {
        const f = details[p.id];
        return (
          <View key={p.id} style={{ padding: 12, borderRadius: 10, backgroundColor: t.card, gap: 8 }}>
            <T bold>{f?.name || f?.phones[0] || 'Loading…'}</T>
            {!!f?.company && <T muted>{f.company}</T>}
            {choosing === p.id ? (
              <>
                <T muted size={13}>Where did you meet?</T>
                <ScrollView horizontal>
                  {suggestEvents(events, p).map((e) => (
                    <Chip key={e.id} label={e.name} onPress={() => accept(p, e.id)} />
                  ))}
                  <Chip label="No event" onPress={() => accept(p, null)} />
                </ScrollView>
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Add context" onPress={() => setChoosing(p.id)} disabled={!f} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button kind="secondary" title="Dismiss" onPress={() => resolveInbox(p.id)} />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </Screen>
  );
}
