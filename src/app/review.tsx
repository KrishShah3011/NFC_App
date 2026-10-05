import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image } from 'react-native';
import { Button, Field, Screen, splitList, T } from '@/components/ui';
import { captureCard } from '@/lib/capture';
import { pickFields, updateCard } from '@/lib/data';
import { parseCardText } from '@/lib/ocr';
import { isInside } from '@/lib/safeUri';
import { normalizePhone } from '@/lib/qr';
import { useData } from '@/lib/store';
import { emptyFields, type Fields } from '@/lib/types';
import { queueCardImage } from '@/lib/uploads';

export default function Review() {
  const params = useLocalSearchParams<{ uri?: string; id?: string }>();
  const id = params.id;
  // Any deep link can reach this route; only accept photos our camera/picker wrote to the app cache,
  // never arbitrary files (e.g. nfcapp://review?uri=file:///…/local.json).
  const uri = isInside(params.uri, Paths.cache.uri) ? params.uri : undefined;
  const { cards, events } = useData();
  const existing = id ? cards.find((c) => c.id === id) : undefined;
  const [f, setF] = useState<Fields>(existing ? pickFields(existing) : emptyFields());
  const [phones, setPhones] = useState(f.phones.join(', '));
  const [emails, setEmails] = useState(f.emails.join(', '));
  const [reading, setReading] = useState(!!uri && !id);
  const set = (k: keyof Omit<Fields, 'phones' | 'emails'>) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!uri || id) return;
    TextRecognition.recognize(uri)
      .then((r) => {
        const p = parseCardText(r.text);
        setF(p);
        setPhones(p.phones.join(', '));
        setEmails(p.emails.join(', '));
      })
      .catch(() => {}) // OCR failed: blank form, photo is kept (spec §10)
      .finally(() => setReading(false));
  }, [uri, id]);

  const save = async (next: boolean) => {
    const v: Fields = {
      ...f,
      name: f.name.trim(),
      phones: splitList(phones).map((p) => normalizePhone(p) ?? p),
      emails: splitList(emails).map((e) => e.toLowerCase()),
    };
    if (!v.name && !v.company && !v.phones.length && !v.emails.length) return Alert.alert('Add at least a name, company, phone or email.');
    if (existing) {
      updateCard(existing.id, { ...v });
      return router.back();
    }
    const newId = captureCard({ ...v, source: 'paper' }, events);
    if (uri) await queueCardImage(newId, uri).catch((e: Error) => Alert.alert('Photo not attached', e.message));
    if (next) router.back(); // back to the camera, still in paper mode
    else router.replace(`/quick/${newId}`);
  };

  return (
    <Screen>
      {uri && <Image source={{ uri }} accessibilityLabel="Card photo" style={{ width: '100%', aspectRatio: 1.75, borderRadius: 10 }} resizeMode="contain" />}
      {reading && <T muted>Reading card…</T>}
      <Field label="Name" value={f.name} onChangeText={set('name')} />
      <Field label="Title" value={f.title} onChangeText={set('title')} />
      <Field label="Company" value={f.company} onChangeText={set('company')} />
      <Field label="Phones (comma separated)" value={phones} onChangeText={setPhones} keyboardType="phone-pad" />
      <Field label="Emails (comma separated)" value={emails} onChangeText={setEmails} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Website" value={f.website} onChangeText={set('website')} autoCapitalize="none" />
      <Field label="Address" value={f.address} onChangeText={set('address')} multiline />
      <Button title="Save" onPress={() => save(false)} disabled={reading} />
      {!existing && <Button kind="secondary" title="Save & scan next" onPress={() => save(true)} disabled={reading} />}
    </Screen>
  );
}
