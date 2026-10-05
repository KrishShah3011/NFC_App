import { AD_GRACE_MS, adsEnabled, isAd, withAdSlots } from './ads';

const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const adIndexes = (xs: unknown[]) => xs.flatMap((x, i) => (isAd(x) ? [i] : []));

test('no ads in the first 7 days', () => {
  expect(adsEnabled(0, AD_GRACE_MS - 1)).toBe(false);
  expect(adsEnabled(0, AD_GRACE_MS)).toBe(true);
});

test('disabled or short lists have no ads', () => {
  expect(withAdSlots(rows(50), false)).toEqual(rows(50));
  expect(adIndexes(withAdSlots(rows(4), true))).toEqual([]);
});

test('ads after rows 5, 25, 45', () => {
  const out = withAdSlots(rows(46), true);
  expect(adIndexes(out)).toEqual([5, 26, 47]);
  expect(out[4]).toBe(5);
  expect(out[6]).toBe(6);
});
