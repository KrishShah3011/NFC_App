import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/CardRow';
import { DateField } from '@/components/DateField';
import { Button, Chip, Field, Screen, splitList, T, useTheme } from '@/components/ui';
import { saveToPhone, updatePhone } from '@/lib/contacts';
import { clearCardField, deleteCard, refreshCard, updateCard } from '@/lib/data';
import { ensureNotificationPermission } from '@/lib/followups';
import { useData } from '@/lib/store';
import { fmtDate, relTime } from '@/lib/time';
import { cardImageUri, deleteCardImage } from '@/lib/uploads';

const at9 = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
};

export default function CardDetail() {
  const { id, already } = useLocalSearchParams<{ id: string; already?: string }>();
  const { cards, events, local } = useData();
  const t = useTheme();
  const c = cards.find((x) => x.id === id);
  const [img, setImg] = useState<string>();
  const [notes, setNotes] = useState(c?.notes ?? '');
  const [tags, setTags] = useState((c?.tags ?? []).join(', '));
  const [place, setPlace] = useState(c?.place?.label ?? '');
  const [fuNote, setFuNote] = useState(c?.followUp?.note ?? '');

  // Live update on open (spec §7.9) and load the card photo.
  const cardId = c?.id;
  useEffect(() => {
    const card = cards.find((x) => x.id === cardId);
    if (!card) return;
    cardImageUri(card).then(setImg);
    void refreshCard(card);
  }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) {
    return (
      <Screen>
        <T>Card not found.</T>
      </Screen>
    );
  }

  const event = events.find((e) => e.id === c.eventId);
  const linked = !!local.inbox.linked[c.id];
  // Card fields come from OCR, QR codes and other users: build dial/mail URLs from validated parts only.
  const phone = c.phones.map((p) => p.replace(/[^\d+]/g, '')).find((p) => /^\+?\d{6,15}$/.test(p));
  const email = c.emails.find((e) => /^[^\s@?&#:/]+@[^\s@?&#:/]+\.[^\s@?&#:/]+$/.test(e));
  const setFollowUp = async (dueAt: number) => {
    updateCard(c.id, { followUp: { dueAt, note: fuNote.trim(), done: false } });
    if (!(await ensureNotificationPermission())) {
      Alert.alert('Reminder saved', 'Turn on notifications to get an alert when it is due.', [
        { text: 'Not now' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const phoneContact = async () => {
    if (linked) Alert.alert((await updatePhone(c)) ? 'Phone contact updated' : 'Could not update the phone contact');
    else Alert.alert((await saveToPhone(c, event?.name)) ? 'Saved to Contacts' : 'Contacts permission is needed');
  };

  const remove = () =>
    Alert.alert('Delete card?', 'This removes it from all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCardImage(c);
          deleteCard(c.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: c.name || 'Card' }} />
      {!!already && <T style={{ color: t.accent }}>Already saved</T>}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={c.name} uri={c.photoUrl} size={64} />
        <View style={{ flex: 1 }}>
          <T size={22} bold>
            {c.name || (c.pending ? 'Loading details…' : 'Unnamed card')}
          </T>
          {!!(c.title || c.company) && <T muted>{[c.title, c.company].filter(Boolean).join(' · ')}</T>}
          {c.unshared && <T muted size={13}>No longer shared</T>}
          {!c.unshared && !!c.profileUpdatedAt && c.profileUpdatedAt > c.createdAt && <T muted size={13}>Updated {relTime(c.profileUpdatedAt)}</T>}
        </View>
      </View>

      <ScrollView horizontal>
        {phone && <Chip label="Call" onPress={() => Linking.openURL(`tel:${phone}`)} />}
        {phone && <Chip label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`)} />}
        {email && <Chip label="Email" onPress={() => Linking.openURL(`mailto:${email}`)} />}
        <Chip label={linked ? 'Update phone contact' : 'Save to Contacts'} onPress={phoneContact} />
      </ScrollView>

      {[...c.phones, ...c.emails, c.website, c.address].filter(Boolean).map((v) => (
        <T key={v}>{v}</T>
      ))}

      <T bold>Where and when you met</T>
      <DateField label="Met" value={c.metAt} onChange={(metAt) => updateCard(c.id, { metAt })} mode="datetime" />
      <Field
        label="Place"
        value={place}
        onChangeText={setPlace}
        onEndEditing={() => (place.trim() ? updateCard(c.id, { place: { ...c.place, label: place.trim() } }) : clearCardField(c.id, 'place'))}
      />
      <ScrollView horizontal>
        <Chip label="No event" active={!c.eventId} onPress={() => clearCardField(c.id, 'eventId')} />
        {events.map((e) => (
          <Chip key={e.id} label={e.name} active={c.eventId === e.id} onPress={() => updateCard(c.id, { eventId: e.id })} />
        ))}
      </ScrollView>

      <Field label="Notes" value={notes} onChangeText={setNotes} multiline onEndEditing={() => updateCard(c.id, { notes: notes.trim() })} />
      <Field
        label="Tags (comma separated)"
        value={tags}
        onChangeText={setTags}
        autoCapitalize="none"
        onEndEditing={() => updateCard(c.id, { tags: splitList(tags.toLowerCase()) })}
      />

      <T bold>Follow-up</T>
      {c.followUp && !c.followUp.done ? (
        <View style={{ gap: 8 }}>
          <T>Due {fmtDate(c.followUp.dueAt)}{c.followUp.note ? ` · ${c.followUp.note}` : ''}</T>
          <Button kind="secondary" title="Mark done" onPress={() => updateCard(c.id, { followUp: { ...c.followUp!, done: true } })} />
          <Button kind="secondary" title="Remove reminder" onPress={() => clearCardField(c.id, 'followUp')} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Field label="Reminder note" value={fuNote} onChangeText={setFuNote} placeholder="Call about the quote" />
          <ScrollView horizontal>
            <Chip label="Tomorrow" onPress={() => setFollowUp(at9(1))} />
            <Chip label="3 days" onPress={() => setFollowUp(at9(3))} />
            <Chip label="1 week" onPress={() => setFollowUp(at9(7))} />
          </ScrollView>
          <DateField label="Custom date" value={c.metAt} onChange={setFollowUp} mode="datetime" />
        </View>
      )}

      {img && <Image source={{ uri: img }} accessibilityLabel="Card photo" style={{ width: '100%', aspectRatio: 1.75, borderRadius: 10 }} resizeMode="contain" />}
      <Button kind="secondary" title="Edit details" onPress={() => router.push({ pathname: '/review', params: { id: c.id } })} />
      <Button kind="danger" title="Delete card" onPress={remove} />
    </Screen>
  );
}
