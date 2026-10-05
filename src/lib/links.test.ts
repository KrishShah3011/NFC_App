import { readFileSync } from 'fs';

const read = (p: string) => readFileSync(p, 'utf8');
const BUNDLE_ID = read('app.config.ts').match(/BUNDLE_ID = '([^']+)'/)![1];

test('AASA routes /p/* to the iOS app', () => {
  const aasa = JSON.parse(read('hosting/.well-known/apple-app-site-association'));
  const d = aasa.applinks.details[0];
  expect(d.appIDs[0].endsWith(`.${BUNDLE_ID}`)).toBe(true);
  expect(d.components).toEqual([{ '/': '/p/*' }]);
});

test('assetlinks targets the Android package', () => {
  const al = JSON.parse(read('hosting/.well-known/assetlinks.json'));
  expect(al[0].target.package_name).toBe(BUNDLE_ID);
  expect(al[0].relation).toContain('delegate_permission/common.handle_all_urls');
});

test('fallback page is not indexable and has no ads', () => {
  const html = read('hosting/p.html');
  expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  expect(html).not.toMatch(/adsbygoogle|googlesyndication/);
  const fb = JSON.parse(read('firebase.json'));
  const h = fb.hosting.headers.find((x: { source: string }) => x.source === '/p/**');
  expect(h.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
});
