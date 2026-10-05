import { isInside } from './safeUri';

const CACHE = 'file:///data/user/0/app/cache/';

test('accepts files inside the directory', () => {
  expect(isInside(`${CACHE}Camera/abc.jpg`, CACHE)).toBe(true);
  expect(isInside(`${CACHE}ImagePicker/x%20y.jpg`, CACHE)).toBe(true);
});

test('rejects traversal, encoded traversal, other dirs and junk', () => {
  expect(isInside(`${CACHE}../files/local.json`, CACHE)).toBe(false);
  expect(isInside(`${CACHE}Camera/..%2F..%2Ffiles%2Flocal.json`, CACHE)).toBe(false);
  expect(isInside(`${CACHE}%2e%2e/files/local.json`, CACHE)).toBe(false);
  expect(isInside('file:///data/user/0/app/files/local.json', CACHE)).toBe(false);
  expect(isInside(`${CACHE}%E0%A4%A`, CACHE)).toBe(false);
  expect(isInside(undefined, CACHE)).toBe(false);
});
