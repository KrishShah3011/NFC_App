import type { Event } from './types';

export type InboxItem = { id: string; since: number; seenAt: number };
export type InboxState = {
  snapshot: string[] | null; // null until the first-run baseline
  pending: InboxItem[];
  dismissed: string[];
  created: string[]; // contacts this app created
  linked: Record<string, string>; // cardId -> phone contact id
};

export const emptyInbox = (): InboxState => ({ snapshot: null, pending: [], dismissed: [], created: [], linked: {} });

/** Diff the phone's contact ids against the last snapshot. Pure. */
export function nextInbox(current: string[], s: InboxState, lastOpenAt: number, now: number) {
  if (!s.snapshot) return { snapshot: current, pending: [] as InboxItem[] };
  const cur = new Set(current);
  const old = new Set(s.snapshot);
  const skip = new Set([...s.dismissed, ...s.created, ...Object.values(s.linked)]);
  const kept = s.pending.filter((p) => cur.has(p.id) && !skip.has(p.id));
  const keptIds = new Set(kept.map((p) => p.id));
  const fresh = current
    .filter((id) => !old.has(id) && !skip.has(id) && !keptIds.has(id))
    .map((id) => ({ id, since: lastOpenAt, seenAt: now }));
  return { snapshot: current, pending: [...kept, ...fresh] };
}

export const suggestEvents = (events: Event[], item: InboxItem) =>
  events.filter((e) => e.startsAt <= item.seenAt && e.endsAt >= item.since);
