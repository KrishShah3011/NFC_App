import Fuse from 'fuse.js';
import { endOfDay } from './time';
import type { Card, CardSource, Event } from './types';

export type Filters = { eventId?: string; tag?: string; from?: number; to?: number; source?: CardSource; due?: boolean };

// ponytail: Fuse index rebuilt per search over all local cards; fine for a few thousand, memoise the index if lists grow 10x.
export function searchCards(cards: Card[], events: Event[], q: string, f: Filters, now = Date.now()): Card[] {
  const eod = endOfDay(now);
  let list = cards.filter(
    (c) =>
      (!f.eventId || c.eventId === f.eventId) &&
      (!f.tag || c.tags.includes(f.tag)) &&
      (f.from == null || c.metAt >= f.from) &&
      (f.to == null || c.metAt < f.to) &&
      (!f.source || c.source === f.source) &&
      (!f.due || (!!c.followUp && !c.followUp.done && c.followUp.dueAt < eod)),
  );
  const query = q.trim();
  if (query) {
    const eventName = new Map(events.map((e) => [e.id, e.name]));
    const docs = list.map((c) => ({ c, event: (c.eventId && eventName.get(c.eventId)) || '', place: c.place?.label ?? '' }));
    const fuse = new Fuse(docs, {
      keys: ['c.name', 'c.company', 'c.title', 'c.notes', 'c.tags', 'event', 'place'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    list = fuse.search(query).map((r) => r.item.c);
  }
  return [...list].sort((a, b) => b.metAt - a.metAt);
}

export const allTags = (cards: Card[]) => [...new Set(cards.flatMap((c) => c.tags))].sort();

export function findDuplicate(
  cards: Card[],
  x: { profileSlug?: string; phones: string[]; emails: string[] },
): Card | undefined {
  if (x.profileSlug) return cards.find((c) => c.profileSlug === x.profileSlug);
  const emails = x.emails.map((e) => e.toLowerCase());
  return cards.find((c) => c.phones.some((p) => x.phones.includes(p)) || c.emails.some((e) => emails.includes(e.toLowerCase())));
}
