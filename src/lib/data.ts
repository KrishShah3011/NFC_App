import { getRandomBytes } from 'expo-crypto';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';
import { auth, db, functions } from './firebase';
import type { Card, Event, Fields, Profile, Socials } from './types';

const uid = () => {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.uid;
};
const cardsCol = () => collection(db, 'users', uid(), 'cards');
const eventsCol = () => collection(db, 'users', uid(), 'events');

// Firestore write promises resolve only after the server acks. Never await them on UI paths: offline = forever.
const fire = (p: Promise<unknown>) => {
  p.catch((e) => console.warn('Firestore write failed', e));
};

const SLUG_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 10 unbiased base62 chars (rejection sampling: bytes >= 248 are skipped). */
export function newSlug(): string {
  let out = '';
  while (out.length < 10) {
    for (const b of getRandomBytes(16)) {
      if (b < 248 && out.length < 10) out += SLUG_CHARS[b % 62];
    }
  }
  return out;
}

export const pickFields = (f: Fields): Fields => ({
  name: f.name,
  title: f.title,
  company: f.company,
  phones: f.phones,
  emails: f.emails,
  website: f.website,
  address: f.address,
});

export function addCard(c: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): string {
  const ref = doc(cardsCol());
  const now = Date.now();
  fire(setDoc(ref, { ...c, createdAt: now, updatedAt: now }));
  return ref.id;
}

export function updateCard(id: string, patch: Record<string, unknown>) {
  fire(updateDoc(doc(cardsCol(), id), { ...patch, updatedAt: Date.now() }));
}

/** Removes an optional field (eventId / followUp / place) from a card. */
export function clearCardField(id: string, field: 'eventId' | 'followUp' | 'place') {
  updateCard(id, { [field]: deleteField() });
}

export function deleteCard(id: string) {
  fire(deleteDoc(doc(cardsCol(), id)));
}

export function watchCards(cb: (cards: Card[]) => void) {
  return onSnapshot(
    query(cardsCol(), orderBy('metAt', 'desc')),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<Card, 'id'>), id: d.id }))),
    (e) => console.warn('watchCards', e),
  );
}

export function addEvent(e: Omit<Event, 'id'>): string {
  const ref = doc(eventsCol());
  fire(setDoc(ref, e));
  return ref.id;
}

export function updateEvent(id: string, patch: Partial<Omit<Event, 'id'>>) {
  fire(updateDoc(doc(eventsCol(), id), patch));
}

export function watchEvents(cb: (events: Event[]) => void) {
  return onSnapshot(
    eventsCol(),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<Event, 'id'>), id: d.id }))),
    (e) => console.warn('watchEvents', e),
  );
}

export function watchUserDoc(cb: (d: { profileSlug?: string; consentAt?: number }) => void) {
  return onSnapshot(doc(db, 'users', uid()), (s) => cb((s.data() ?? {}) as { profileSlug?: string; consentAt?: number }));
}

export function watchProfile(slug: string, cb: (p: Profile | null) => void) {
  return onSnapshot(doc(db, 'profiles', slug), (s) => cb(s.exists() ? sanitizeProfile(s.data()) : null));
}

const STORAGE_URL = /^https:\/\/firebasestorage\.googleapis\.com\//;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const strs = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5).map((x) => x.slice(0, max)) : [];

/** Profiles are written by other users: keep only well-typed, bounded fields; photos only from our
 *  Storage (no tracking pixels on third-party hosts); websites only http(s). null = unusable. */
export function sanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 100);
  if (!name.trim()) return null;
  const site = str(r.website, 200).trim();
  const photo = str(r.photoUrl, 1000);
  const so = (r.socials && typeof r.socials === 'object' ? r.socials : {}) as Record<string, unknown>;
  const social = (k: string) => str(so[k], 200) || undefined;
  return {
    ownerUid: str(r.ownerUid, 128),
    name,
    title: str(r.title, 100),
    company: str(r.company, 100),
    phones: strs(r.phones, 30).filter((p) => /^[\d+\-() ]+$/.test(p)),
    emails: strs(r.emails, 254).filter((e) => /^[^\s@]+@[^\s@]+$/.test(e)),
    website: /^https?:\/\//i.test(site) ? site : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(site) ? `https://${site}` : '',
    address: str(r.address, 300),
    socials: { linkedin: social('linkedin'), x: social('x'), instagram: social('instagram'), whatsapp: social('whatsapp') },
    photoUrl: STORAGE_URL.test(photo) ? photo : '',
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
}

export function recordConsent() {
  fire(setDoc(doc(db, 'users', uid()), { consentAt: Date.now() }, { merge: true }));
}

export type ProfileInput = Fields & { socials: Socials; photoUrl: string };

/** Saves the profile, creating the slug on first save. Returns the slug immediately. */
export function saveMyProfile(slug: string | undefined, f: ProfileInput): string {
  const s = slug ?? newSlug();
  const p: Profile = { ...pickFields(f), socials: f.socials, photoUrl: f.photoUrl, ownerUid: uid(), updatedAt: Date.now() };
  fire(setDoc(doc(db, 'profiles', s), p));
  if (!slug) fire(setDoc(doc(db, 'users', uid()), { profileSlug: s }, { merge: true }));
  return s;
}

/** null = not found; throws 'timeout' when the server can't be reached in time. */
export async function fetchProfile(slug: string, timeoutMs = 3000): Promise<Profile | null> {
  const snap = await Promise.race([
    getDoc(doc(db, 'profiles', slug)),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
  ]);
  return snap.exists() ? sanitizeProfile(snap.data()) : null;
}

/** Live update + pending resolution for one card received from an app user (spec §7.9).
 *  Returns the updated card when details changed, else undefined. */
export async function refreshCard(c: Card): Promise<Card | undefined> {
  if (!c.profileSlug || c.unshared) return undefined;
  let p: Profile | null;
  try {
    p = await fetchProfile(c.profileSlug);
  } catch {
    return undefined; // offline: try again next time
  }
  if (!p) {
    updateCard(c.id, { unshared: true, pending: false });
    return undefined;
  }
  if (!c.pending && p.updatedAt === c.profileUpdatedAt) return undefined;
  const patch = { ...pickFields(p), photoUrl: p.photoUrl, profileUpdatedAt: p.updatedAt, pending: false };
  updateCard(c.id, patch);
  return { ...c, ...patch };
}

export async function deleteAccount() {
  await httpsCallable(functions, 'deleteAccount')();
}
