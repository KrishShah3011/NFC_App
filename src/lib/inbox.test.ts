import { emptyInbox, nextInbox, suggestEvents } from './inbox';

test('first run only records a baseline', () => {
  expect(nextInbox(['1', '2'], emptyInbox(), 0, 100)).toEqual({ snapshot: ['1', '2'], pending: [] });
});

test('new contacts go to pending with their detection window', () => {
  const s = { ...emptyInbox(), snapshot: ['1'] };
  expect(nextInbox(['1', '2'], s, 50, 100).pending).toEqual([{ id: '2', since: 50, seenAt: 100 }]);
});

test('app-created, linked and dismissed contacts never appear', () => {
  const s = { ...emptyInbox(), snapshot: ['1'], created: ['2'], dismissed: ['3'], linked: { cardA: '4' } };
  expect(nextInbox(['1', '2', '3', '4', '5'], s, 0, 9).pending.map((p) => p.id)).toEqual(['5']);
});

test('pending survives later runs, drops deleted or dismissed contacts, no duplicates', () => {
  const s = { ...emptyInbox(), snapshot: ['1', '2', '3'], pending: [{ id: '2', since: 1, seenAt: 2 }, { id: '3', since: 1, seenAt: 2 }] };
  const r = nextInbox(['1', '3'], { ...s, dismissed: ['3'] }, 5, 6);
  expect(r.pending).toEqual([]);
  const r2 = nextInbox(['1', '2', '3'], s, 5, 6);
  expect(r2.pending.map((p) => p.id)).toEqual(['2', '3']);
});

test('suggestEvents returns events overlapping the detection window', () => {
  const ev = [
    { id: 'a', name: 'A', startsAt: 0, endsAt: 10 },
    { id: 'b', name: 'B', startsAt: 20, endsAt: 30 },
  ];
  expect(suggestEvents(ev, { id: 'x', since: 5, seenAt: 15 }).map((e) => e.id)).toEqual(['a']);
});
