import * as Location from 'expo-location';
import { saveToPhone } from './contacts';
import { addCard, updateCard } from './data';
import { track } from './firebase';
import { readLocal } from './local';
import { activeEvent } from './time';
import type { Card, CardSource, Event, Fields, Place } from './types';

export type NewCard = Fields & {
  source: CardSource;
  profileSlug?: string;
  profileUpdatedAt?: number;
  pending?: boolean;
  photoUrl?: string;
};

// The in-app scanner vouches for the very next /p/{slug} navigation; links from anywhere else
// (web pages, other apps, NFC tags, the system camera) don't carry this, so they ask for one tap.
let trusted: { slug: string; at: number } | null = null;
export const trustScan = (slug: string) => {
  trusted = { slug, at: Date.now() };
};
export function consumeTrustedScan(slug: string): boolean {
  const ok = !!trusted && trusted.slug === slug && Date.now() - trusted.at < 5000;
  trusted = null;
  return ok;
}

/** Saves instantly with time + active event; place and phone write-through follow in the background (spec §7.3). */
export function captureCard(
  base: NewCard,
  events: Event[],
  opts: { eventId?: string | null; metAt?: number; skipPlace?: boolean; skipPhone?: boolean } = {},
): string {
  const now = Date.now();
  const metAt = opts.metAt ?? now;
  const eventId = opts.eventId === undefined ? activeEvent(events, metAt)?.id : (opts.eventId ?? undefined);
  const card = { ...base, metAt, eventId, notes: '', tags: [] as string[] };
  const id = addCard(card);
  track('card_saved', { source: base.source });
  const { settings } = readLocal();
  if (settings.location && !opts.skipPlace) {
    locate()
      .then((place) => place && updateCard(id, { place }))
      .catch(() => {});
  }
  if (settings.saveToContacts && !opts.skipPhone) {
    const full: Card = { ...card, id, createdAt: now, updatedAt: now };
    saveToPhone(full, events.find((e) => e.id === eventId)?.name).catch(() => {});
  }
  return id;
}

export async function locate(timeoutMs = 5000): Promise<Place | undefined> {
  const perm = await Location.getForegroundPermissionsAsync();
  const granted = perm.granted || (perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
  if (!granted) return undefined;
  const pos = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
  ]);
  if (!pos) return undefined;
  const place: Place = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const label = await placeLabel(place);
  return label ? { ...place, label } : place;
}

/** "Koregaon Park, Pune"; undefined when offline (the store fills it in later). */
export async function placeLabel(p: Place): Promise<string | undefined> {
  if (p.lat == null || p.lng == null) return undefined;
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    if (!a) return undefined;
    return [a.district ?? a.subregion ?? a.street, a.city].filter(Boolean).join(', ') || undefined;
  } catch {
    return undefined;
  }
}
