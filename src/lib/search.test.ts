import { allTags, findDuplicate, searchCards } from './search';
import { activeEvent, endOfDay, relTime, startOfWeek } from './time';
import type { Card, Event } from './types';

const T0 = new Date(2026, 2, 12, 15, 0).getTime(); // Thu 12 Mar 2026 15:00 local
const H = 3600000;

const card = (p: Partial<Card>): Card => ({
  id: p.id ?? 'x',
  source: 'paper',
  name: '',
  title: '',
  company: '',
  phones: [],
  emails: [],
  website: '',
  address: '',
  notes: '',
  tags: [],
  metAt: T0,
  createdAt: T0,
  updatedAt: T0,
  ...p,
});

const events: Event[] = [{ id: 'e1', name: 'Pune Packaging Expo', startsAt: T0 - 5 * H, endsAt: endOfDay(T0) }];
const cards = [
  card({ id: 'a', name: 'Rahul Sharma', company: 'Acme Packaging', eventId: 'e1', tags: ['vendor'], metAt: T0 - H }),
  card({ id: 'b', name: 'Priya Nair', company: 'BrightLeaf', notes: 'wants quote for 5k units', metAt: T0 - 2 * H, source: 'app' }),
  card({ id: 'c', name: 'Karan Mehta', place: { lat: 0, lng: 0, label: 'Koregaon Park, Pune' }, metAt: T0 - 30 * 24 * H, tags: ['investor'] }),
  card({ id: 'd', name: 'Neha Gupta', followUp: { dueAt: T0 + H, note: 'call', done: false }, metAt: T0 - 3 * H }),
];

test('no query returns everything newest first', () => {
  expect(searchCards(cards, events, '', {}, T0).map((c) => c.id)).toEqual(['a', 'b', 'd', 'c']);
});

test('fuzzy query tolerates typos and searches event, place and notes', () => {
  expect(searchCards(cards, events, 'rahl', {}, T0).map((c) => c.id)).toEqual(['a']);
  expect(searchCards(cards, events, 'packaging expo', {}, T0).map((c) => c.id)).toContain('a');
  expect(searchCards(cards, events, 'koregaon', {}, T0).map((c) => c.id)).toEqual(['c']);
  expect(searchCards(cards, events, 'quote', {}, T0).map((c) => c.id)).toEqual(['b']);
});

test('filters: event, tag, date range, source, due today', () => {
  expect(searchCards(cards, events, '', { eventId: 'e1' }, T0).map((c) => c.id)).toEqual(['a']);
  expect(searchCards(cards, events, '', { tag: 'investor' }, T0).map((c) => c.id)).toEqual(['c']);
  expect(searchCards(cards, events, '', { from: startOfWeek(T0) }, T0).map((c) => c.id)).toEqual(['a', 'b', 'd']);
  expect(searchCards(cards, events, '', { source: 'app' }, T0).map((c) => c.id)).toEqual(['b']);
  expect(searchCards(cards, events, '', { due: true }, T0).map((c) => c.id)).toEqual(['d']);
});

test('allTags is unique and sorted', () => {
  expect(allTags(cards)).toEqual(['investor', 'vendor']);
});

test('findDuplicate matches by profile slug, else by phone or email', () => {
  const list = [card({ id: 'p', profileSlug: 'Ab3dE5gH7j' }), card({ id: 'q', phones: ['+919820123456'], emails: ['k@x.in'] })];
  expect(findDuplicate(list, { profileSlug: 'Ab3dE5gH7j', phones: [], emails: [] })?.id).toBe('p');
  expect(findDuplicate(list, { profileSlug: 'Zz9yX8wV7u', phones: [], emails: [] })).toBeUndefined();
  expect(findDuplicate(list, { phones: ['+919820123456'], emails: [] })?.id).toBe('q');
  expect(findDuplicate(list, { phones: [], emails: ['K@X.IN'] })?.id).toBe('q');
  expect(findDuplicate(list, { phones: ['+911111111111'], emails: [] })).toBeUndefined();
});

test('time helpers', () => {
  expect(endOfDay(T0)).toBe(new Date(2026, 2, 13, 0, 0).getTime());
  expect(new Date(startOfWeek(T0)).getDay()).toBe(1);
  expect(activeEvent(events, T0)?.id).toBe('e1');
  expect(activeEvent(events, endOfDay(T0))).toBeUndefined();
  expect(relTime(T0 - 2 * 24 * H, T0)).toBe('2 days ago');
  expect(relTime(T0 - 30 * 1000, T0)).toBe('just now');
});
