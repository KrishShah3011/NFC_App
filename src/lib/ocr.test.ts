import { parseCardText } from './ocr';

type Fixture = { text: string; name: string; company: string; phones: string[]; emails: string[] };
const fixtures: Fixture[] = require('./__fixtures__/cards.json');

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

test('accuracy gate: phones/emails >= 95%, name/company >= 80%', () => {
  const parsed = fixtures.map((fx) => ({ fx, got: parseCardText(fx.text) }));
  const rate = (ok: (fx: Fixture, got: ReturnType<typeof parseCardText>) => boolean) =>
    parsed.filter(({ fx, got }) => ok(fx, got)).length / parsed.length;
  const misses = parsed
    .filter(({ fx, got }) => norm(fx.name) !== norm(got.name) || norm(fx.company) !== norm(got.company) || !sameSet(fx.phones, got.phones))
    .map(({ fx, got }) => ({ want: [fx.name, fx.company, fx.phones], got: [got.name, got.company, got.phones] }));
  if (misses.length) console.log(JSON.stringify(misses, null, 1)); // tuning aid
  expect(rate((fx, g) => sameSet(fx.phones, g.phones))).toBeGreaterThanOrEqual(0.95);
  expect(rate((fx, g) => sameSet(fx.emails, g.emails))).toBeGreaterThanOrEqual(0.95);
  expect(rate((fx, g) => norm(fx.name) === norm(g.name))).toBeGreaterThanOrEqual(0.8);
  expect(rate((fx, g) => norm(fx.company) === norm(g.company))).toBeGreaterThanOrEqual(0.8);
});

test('all-caps names are title-cased; address and website extracted', () => {
  const f = parseCardText('ARJUN REDDY\nArchitect\nStudio Reddy Design\nJubilee Hills, Hyderabad 500033\nstudioreddy.com');
  expect(f.name).toBe('Arjun Reddy');
  expect(f.title).toBe('Architect');
  expect(f.address).toBe('Jubilee Hills, Hyderabad 500033');
  expect(f.website).toBe('studioreddy.com');
});

test('fax numbers are ignored, phone on the same line kept', () => {
  expect(parseCardText('A B\nPh: 0891-2577000 Fax: 0891-2577001').phones).toEqual(['+918912577000']);
});

test('empty or junk text gives empty fields without throwing', () => {
  expect(parseCardText('')).toEqual({ name: '', title: '', company: '', phones: [], emails: [], website: '', address: '' });
  expect(parseCardText('@@@ ### 12').phones).toEqual([]);
});
