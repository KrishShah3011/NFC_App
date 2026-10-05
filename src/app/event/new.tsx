import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { DateField } from '@/components/DateField';
import { Button, Field, Screen } from '@/components/ui';
import { addEvent } from '@/lib/data';
import { endOfDay } from '@/lib/time';

export default function NewEvent() {
  const [name, setName] = useState('');
  const [endsAt, setEndsAt] = useState(() => endOfDay(Date.now())); // default: local midnight (spec §7.6)
  const [venue, setVenue] = useState('');

  const save = () => {
    if (!name.trim()) return Alert.alert('Name the event first.');
    const now = Date.now();
    addEvent({ name: name.trim(), startsAt: now, endsAt: Math.max(endsAt, now + 60000), ...(venue.trim() ? { placeLabel: venue.trim() } : {}) });
    router.back();
  };

  return (
    <Screen>
      <Field label="Event name" value={name} onChangeText={setName} placeholder="Pune Packaging Expo" autoFocus maxLength={100} />
      <DateField label="Ends" value={endsAt} onChange={setEndsAt} mode="datetime" />
      <Field label="Venue (optional)" value={venue} onChangeText={setVenue} maxLength={100} />
      <Button title="Start event" onPress={save} />
    </Screen>
  );
}
