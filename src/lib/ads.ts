export const AD_GRACE_MS = 7 * 86400000;

export const adsEnabled = (signupAt: number, now: number) => now - signupAt >= AD_GRACE_MS;

export type AdSlot = { ad: true; key: string };

export const isAd = (x: unknown): x is AdSlot => typeof x === 'object' && x !== null && (x as AdSlot).ad === true;

/** Insert a native ad after rows 5, 25, 45, ... (spec §4). */
export function withAdSlots<T>(rows: T[], enabled: boolean): (T | AdSlot)[] {
  if (!enabled) return rows;
  const out: (T | AdSlot)[] = [];
  rows.forEach((r, i) => {
    out.push(r);
    const n = i + 1;
    if (n >= 5 && (n - 5) % 20 === 0) out.push({ ad: true, key: `ad-${n}` });
  });
  return out;
}
