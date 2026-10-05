// jest.mock calls are hoisted above these imports by babel-jest.
import { setDoc } from '@react-native-firebase/firestore';
import { addCard, fetchProfile, newSlug, saveMyProfile } from './data';

jest.mock('./firebase', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {}, functions: {} }));
jest.mock('@react-native-firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('@react-native-firebase/firestore', () => {
  const never = () => new Promise(() => {}); // offline: server ack never arrives
  return {
    collection: jest.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
    doc: jest.fn((parent: unknown, ...rest: string[]) => ({ id: rest.length ? rest[rest.length - 1] : 'generated-id', parent })),
    setDoc: jest.fn(never),
    updateDoc: jest.fn(never),
    deleteDoc: jest.fn(never),
    deleteField: jest.fn(() => '__delete__'),
    getDoc: jest.fn(never),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
  };
});
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i % 2 ? 255 : 3 + i)), // includes rejected bytes
}));


const base = { source: 'paper' as const, name: 'A', title: '', company: '', phones: [], emails: [], website: '', address: '', metAt: 1, notes: '', tags: [] };

test('addCard returns an id synchronously even when the write never resolves (offline)', () => {
  expect(addCard(base)).toBe('generated-id');
  expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: 'A', createdAt: expect.any(Number) }));
});

test('saveMyProfile creates a slug and returns without waiting on the server', () => {
  const slug = saveMyProfile(undefined, { ...base, socials: {}, photoUrl: '' });
  expect(slug).toMatch(/^[A-Za-z0-9]{10}$/);
});

test('newSlug uses rejection sampling and yields 10 base62 chars', () => {
  expect(newSlug()).toMatch(/^[A-Za-z0-9]{10}$/);
});

test('fetchProfile times out instead of hanging offline', async () => {
  await expect(fetchProfile('Ab3dE5gH7j', 20)).rejects.toThrow('timeout');
});
