import { onAuthStateChanged, type User } from '@react-native-firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { placeLabel } from './capture';
import { checkInbox, saveToPhone } from './contacts';
import { refreshCard, updateCard, watchCards, watchEvents, watchProfile, watchUserDoc } from './data';
import { auth } from './firebase';
import { followUpSignature, rescheduleAll } from './followups';
import { readLocal, subscribeLocal, writeLocal, type Local } from './local';
import { DAY } from './time';
import type { Card, Event, Profile } from './types';
import { flushUploads } from './uploads';

type Data = {
  ready: boolean;
  user: User | null;
  slug?: string;
  profile: Profile | null;
  cards: Card[];
  events: Event[];
  local: Local;
  inboxEnabled: boolean;
  refreshInbox: () => Promise<void>;
};

const Ctx = createContext<Data | null>(null);

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData must be used inside DataProvider');
  return d;
}

// Each snapshot remembers whose data it is (uid or slug), so stale data from a previous
// account is ignored by derivation instead of being reset with setState in an effect.
type Keyed<T> = { key: string; value: T };
const NO_EVENTS: Event[] = [];

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [docSnap, setDocSnap] = useState<Keyed<{ profileSlug?: string }>>();
  const [cardsSnap, setCardsSnap] = useState<Keyed<Card[]>>();
  const [eventsSnap, setEventsSnap] = useState<Keyed<Event[]>>();
  const [profileSnap, setProfileSnap] = useState<Keyed<Profile | null>>();
  const [inboxEnabled, setInboxEnabled] = useState(false);
  const local = useSyncExternalStore(subscribeLocal, readLocal);
  const refreshInbox = useCallback(async () => setInboxEnabled(await checkInbox().catch(() => false)), []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    const key = user.uid;
    const subs = [
      watchUserDoc((value) => setDocSnap({ key, value })),
      watchCards((value) => setCardsSnap({ key, value })),
      watchEvents((value) => setEventsSnap({ key, value })),
    ];
    return () => subs.forEach((unsub) => unsub());
  }, [user]);

  const uid = user?.uid;
  const userDoc = docSnap?.key === uid ? docSnap?.value : undefined;
  const cards = cardsSnap?.key === uid ? cardsSnap?.value : undefined;
  const events = eventsSnap?.key === uid && eventsSnap ? eventsSnap.value : NO_EVENTS;
  const slug = userDoc?.profileSlug;

  useEffect(() => {
    if (!slug) return;
    return watchProfile(slug, (value) => setProfileSnap({ key: slug, value }));
  }, [slug]);
  const profile = slug ? (profileSnap?.key === slug ? profileSnap.value : undefined) : userDoc ? null : undefined;

  // Latest values for async housekeeping, synced after render (refs must not be written during render).
  const cardsRef = useRef(cards);
  const eventsRef = useRef(events);
  useEffect(() => {
    cardsRef.current = cards;
    eventsRef.current = events;
  }, [cards, events]);

  // Reschedule reminders when the set of open follow-ups changes, and once at startup (spec §7.8).
  const sig = cards ? followUpSignature(cards) : null;
  useEffect(() => {
    if (cardsRef.current) rescheduleAll(cardsRef.current).catch(() => {});
  }, [sig]);

  // Foreground housekeeping: inbox, uploads, pending cards, place labels, weekly live refresh.
  const loaded = cards !== undefined;
  useEffect(() => {
    if (!user || !loaded) return;
    const run = async () => {
      await refreshInbox();
      void flushUploads();
      const list = cardsRef.current ?? [];
      const now = Date.now();
      // ponytail: sequential refresh; offline costs N x 3 s in the background, batch if lists get large.
      const weekly = now - readLocal().lastFullRefresh > 7 * DAY;
      for (const c of list) {
        if (!c.profileSlug || !(c.pending || weekly)) continue;
        const updated = await refreshCard(c);
        // Offline captures skipped the phone write-through; do it once details arrive (spec §7.3).
        const l = readLocal();
        if (updated && c.pending && l.settings.saveToContacts && !l.inbox.linked[c.id]) {
          saveToPhone(updated, eventsRef.current.find((e) => e.id === c.eventId)?.name).catch(() => {});
        }
      }
      if (weekly) writeLocal({ lastFullRefresh: now });
      for (const c of list.filter((x) => x.place?.lat != null && !x.place.label).slice(0, 10)) {
        const label = await placeLabel(c.place!);
        if (label) updateCard(c.id, { place: { ...c.place!, label } });
      }
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    const timer = setInterval(() => readLocal().uploads.length && void flushUploads(), 30000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [user, loaded, refreshInbox]);

  const ready = user === null || (user !== undefined && userDoc !== undefined && loaded && (!slug || profile !== undefined));
  const value = useMemo<Data>(
    () => ({ ready, user: user ?? null, slug, profile: profile ?? null, cards: cards ?? [], events, local, inboxEnabled, refreshInbox }),
    [ready, user, slug, profile, cards, events, local, inboxEnabled, refreshInbox],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
