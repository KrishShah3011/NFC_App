import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Screen, T, useNow } from '@/components/ui';
import { captureCard } from '@/lib/capture';
import { parseQr } from '@/lib/qr';
import { findDuplicate } from '@/lib/search';
import { useData } from '@/lib/store';
import { activeEvent } from '@/lib/time';

export default function Scan() {
  const { cards, events } = useData();
  const [perm, requestPerm] = useCameraPermissions();
  const [mode, setMode] = useState<'qr' | 'paper'>('qr');
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const cam = useRef<CameraView>(null);
  const now = useNow();
  const busy = useRef(false); // onBarcodeScanned fires many times a second: one scan -> one card

  // Only one camera preview may run; unmount it when the tab loses focus.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2000);
  };
  const release = () => setTimeout(() => (busy.current = false), 1500);

  const onScan = ({ data }: { data: string }) => {
    if (busy.current) return;
    busy.current = true;
    const r = parseQr(data);
    if (!r) flash('Not a contact QR code');
    else if (r.kind === 'profile') router.push(`/p/${r.slug}`);
    else {
      const dup = findDuplicate(cards, { phones: r.fields.phones, emails: r.fields.emails });
      if (dup) router.push({ pathname: '/card/[id]', params: { id: dup.id, already: '1' } });
      else router.push(`/quick/${captureCard({ ...r.fields, source: 'manual' }, events)}`);
    }
    release();
  };

  const shoot = async () => {
    if (!ready || !cam.current) return;
    const photo = await cam.current.takePictureAsync({ quality: 0.5 });
    if (photo?.uri) router.push({ pathname: '/review', params: { uri: photo.uri } });
  };

  const fromPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!r.canceled) router.push({ pathname: '/review', params: { uri: r.assets[0].uri } });
  };

  if (!perm) return null;
  if (!perm.granted) {
    return (
      <Screen>
        <T>Camera access lets you scan QR codes and paper visiting cards.</T>
        <Button title={perm.canAskAgain ? 'Allow camera' : 'Open Settings'} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
        <Button kind="secondary" title="From photo" onPress={fromPhoto} />
      </Screen>
    );
  }

  const event = activeEvent(events, now);
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {focused && (
        <CameraView
          ref={cam}
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={mode === 'qr' ? onScan : undefined}
          onCameraReady={() => setReady(true)}
        />
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 12, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        {event && <Text style={{ color: '#fff' }}>At {event.name}</Text>}
        {!!toast && (
          <Text accessibilityLiveRegion="polite" style={{ color: '#fff', fontWeight: '600' }}>
            {toast}
          </Text>
        )}
        <ScrollView horizontal>
          <Chip label="QR code" active={mode === 'qr'} onPress={() => setMode('qr')} />
          <Chip label="Paper card" active={mode === 'paper'} onPress={() => setMode('paper')} />
          <Chip label="From photo" onPress={fromPhoto} />
        </ScrollView>
        {mode === 'paper' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo of card"
            onPress={shoot}
            style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: '#fff' }}
          />
        )}
      </View>
    </View>
  );
}
