import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable } from 'react-native';
import { Button, Field, Screen, splitList, T, useTheme } from '@/components/ui';
import { pickFields, saveMyProfile, type ProfileInput } from '@/lib/data';
import { parseCardText } from '@/lib/ocr';
import { normalizePhone } from '@/lib/qr';
import { useData } from '@/lib/store';
import { emptyFields, type Fields, type Socials } from '@/lib/types';
import { uploadProfilePhoto } from '@/lib/uploads';

export default function ProfileEdit() {
  const { profile, slug } = useData();
  const t = useTheme();
  const [f, setF] = useState<Fields>(profile ? pickFields(profile) : emptyFields());
  const [phones, setPhones] = useState(f.phones.join(', '));
  const [emails, setEmails] = useState(f.emails.join(', '));
  const [socials, setSocials] = useState<Socials>(profile?.socials ?? {});
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false); // a double tap must not mint two public profiles
  const set = (k: keyof Omit<Fields, 'phones' | 'emails'>) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const setSocial = (k: keyof Socials) => (v: string) => setSocials((s) => ({ ...s, [k]: v.trim() || undefined }));

  // Fastest onboarding: photograph your own paper card (spec §7.1).
  const fillFromCard = async () => {
    if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) return Alert.alert('Camera permission is needed to scan your card.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (r.canceled) return;
    const p = parseCardText((await TextRecognition.recognize(r.assets[0].uri)).text);
    setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(p).filter(([, v]) => (Array.isArray(v) ? v.length : v))) }));
    if (p.phones.length) setPhones(p.phones.join(', '));
    if (p.emails.length) setEmails(p.emails.join(', '));
  };

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  const save = async () => {
    const name = f.name.trim();
    if (!name) return Alert.alert('Add your name first.');
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    const input: ProfileInput = {
      ...f,
      name,
      phones: splitList(phones).map((p) => normalizePhone(p) ?? p).slice(0, 5),
      emails: splitList(emails).slice(0, 5),
      socials,
      photoUrl: profile?.photoUrl ?? '',
    };
    const first = !slug;
    const s = saveMyProfile(slug, input);
    if (photo) {
      try {
        saveMyProfile(s, { ...input, photoUrl: await uploadProfilePhoto(s, photo) });
      } catch (e) {
        Alert.alert('Photo not uploaded', String((e as Error).message));
      }
    }
    if (!first) return router.back(); // screen unmounts; the lock never needs releasing
    router.replace('/');
    Alert.alert('Share by tapping phones?', 'Set your card as "My Card" so NameDrop (iPhone) and Tap to Share (Android) send it.', [
      { text: 'Later' },
      { text: 'Show me', onPress: () => router.push('/me?guide=1') },
    ]);
  };

  return (
    <Screen>
      {!profile && <Button kind="secondary" title="Fill from my paper card" onPress={fillFromCard} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Choose profile photo" onPress={pickPhoto} style={{ alignSelf: 'center' }}>
        {photo || profile?.photoUrl ? (
          <Image source={{ uri: photo ?? profile!.photoUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} />
        ) : (
          <T style={{ color: t.accent }}>Add photo</T>
        )}
      </Pressable>
      <Field label="Name *" value={f.name} onChangeText={set('name')} maxLength={100} autoComplete="name" />
      <Field label="Title" value={f.title} onChangeText={set('title')} maxLength={100} />
      <Field label="Company" value={f.company} onChangeText={set('company')} maxLength={100} />
      <Field label="Phones (comma separated)" value={phones} onChangeText={setPhones} keyboardType="phone-pad" />
      <Field label="Emails (comma separated)" value={emails} onChangeText={setEmails} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Website" value={f.website} onChangeText={set('website')} maxLength={200} autoCapitalize="none" keyboardType="url" />
      <Field label="Address" value={f.address} onChangeText={set('address')} maxLength={300} multiline />
      <Field label="LinkedIn" value={socials.linkedin ?? ''} onChangeText={setSocial('linkedin')} autoCapitalize="none" />
      <Field label="X" value={socials.x ?? ''} onChangeText={setSocial('x')} autoCapitalize="none" />
      <Field label="Instagram" value={socials.instagram ?? ''} onChangeText={setSocial('instagram')} autoCapitalize="none" />
      <Field label="WhatsApp" value={socials.whatsapp ?? ''} onChangeText={setSocial('whatsapp')} keyboardType="phone-pad" />
      <Button title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
    </Screen>
  );
}
