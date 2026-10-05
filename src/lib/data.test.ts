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

describe('sanitizeProfile (profiles are written by other users)', () => {
  const { sanitizeProfile } = jest.requireActual('./data') as typeof import('./data');
  const good = {
    ownerUid: 'u2',
    name: 'Asha Rao',
    title: 'CEO',
    company: 'Acme',
    phones: ['+91 98765 43210'],
    emails: ['asha@acme.in'],
    website: 'acme.in',
    address: 'Pune',
    socials: { linkedin: 'asha' },
    photoUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/profiles%2FAb3dE5gH7j.jpg?alt=media',
    updatedAt: 5,
  };

  test('keeps a well-formed profile; bare website gets https', () => {
    const p = sanitizeProfile(good)!;
    expect(p.name).toBe('Asha Rao');
    expect(p.website).toBe('https://acme.in');
    expect(p.photoUrl).toBe(good.photoUrl);
  });

  test('drops tracking photos, non-http links and junk types', () => {
    const p = sanitizeProfile({
      ...good,
      photoUrl: 'https://evil.example/pixel.gif',
      website: 'javascript:alert(1)',
      phones: ['+1 555', 42, '<script>'],
      emails: ['not-an-email', 'ok@x.in'],
      title: { x: 1 },
    })!;
    expect(p.photoUrl).toBe('');
    expect(p.website).toBe('');
    expect(p.phones).toEqual(['+1 555']);
    expect(p.emails).toEqual(['ok@x.in']);
    expect(p.title).toBe('');
  });

  test('rejects nameless or non-object data and caps sizes', () => {
    expect(sanitizeProfile(null)).toBeNull();
    expect(sanitizeProfile({ ...good, name: '   ' })).toBeNull();
    const p = sanitizeProfile({ ...good, name: 'x'.repeat(500), phones: Array(20).fill('123') })!;
    expect(p.name).toHaveLength(100);
    expect(p.phones).toHaveLength(5);
  });
});
