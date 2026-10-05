const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { doc, getDoc, setDoc, updateDoc, getDocs, collection } = require('firebase/firestore');
const { ref, uploadBytes, getBytes } = require('firebase/storage');

const SLUG = 'Ab3dE5gH7j';
const profile = (uid, extra = {}) => ({
  ownerUid: uid,
  name: 'Asha Rao',
  title: '',
  company: '',
  phones: [],
  emails: [],
  website: '',
  address: '',
  socials: {},
  photoUrl: '',
  updatedAt: 1,
  ...extra,
});

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nfc',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

const ctx = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext());
const db = (uid) => ctx(uid).firestore();
const st = (uid) => ctx(uid).storage();
const seedProfile = () => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'profiles', SLUG), profile('alice')));
const bytes = (n) => new Uint8Array(n);
const JPEG = { contentType: 'image/jpeg' };

test('anyone can get a profile by slug; nobody can list profiles', async () => {
  await seedProfile();
  await assertSucceeds(getDoc(doc(db(null), 'profiles', SLUG)));
  await assertFails(getDocs(collection(db(null), 'profiles')));
  await assertFails(getDocs(collection(db('alice'), 'profiles')));
});

test('owner creates and updates own profile; others cannot', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice')));
  await assertFails(setDoc(doc(db('bob'), 'profiles', SLUG), profile('bob')));
  await assertFails(updateDoc(doc(db('bob'), 'profiles', SLUG), { name: 'Hacked' }));
  await assertSucceeds(updateDoc(doc(db('alice'), 'profiles', SLUG), { name: 'Asha R', updatedAt: 2 }));
});

test('profile validation: slug format, ownerUid, required name, sizes, no extra keys, auth', async () => {
  await assertFails(setDoc(doc(db('alice'), 'profiles', 'short'), profile('alice')));
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('bob')));
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { name: '' })));
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { name: 'x'.repeat(101) })));
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { isAdmin: true })));
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { phones: ['1', '2', '3', '4', '5', '6'] })));
  await assertFails(setDoc(doc(db(null), 'profiles', SLUG), profile('alice')));
});

test('profile links: photo only from Firebase Storage, website only http(s) or bare domain', async () => {
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { photoUrl: 'https://evil.example/pixel.gif' })));
  await assertFails(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { website: 'javascript:alert(1)' })));
  await assertSucceeds(setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { website: 'acme.in' })));
  await assertSucceeds(
    setDoc(doc(db('alice'), 'profiles', SLUG), profile('alice', { website: 'https://acme.in', photoUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/p.jpg' })),
  );
});

test('users/{uid} subtree is private to its owner', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), { profileSlug: SLUG, consentAt: 1 }));
  await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice', 'cards', 'c1'), { name: 'X' }));
  await assertFails(getDoc(doc(db('bob'), 'users', 'alice', 'cards', 'c1')));
  await assertFails(getDocs(collection(db('bob'), 'users', 'alice', 'cards')));
  await assertFails(setDoc(doc(db('bob'), 'users', 'alice', 'events', 'e1'), { name: 'X' }));
  await assertFails(getDoc(doc(db(null), 'users', 'alice')));
});

test('profile photo: owner only, images only, under 2 MB, public read', async () => {
  await seedProfile();
  const path = `profiles/${SLUG}.jpg`;
  await assertSucceeds(uploadBytes(ref(st('alice'), path), bytes(10), JPEG));
  await assertFails(uploadBytes(ref(st('bob'), path), bytes(10), JPEG));
  await assertFails(uploadBytes(ref(st('alice'), path), bytes(10), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(st('alice'), path), bytes(2 * 1024 * 1024 + 1), JPEG));
  await assertSucceeds(getBytes(ref(st(null), path)));
});

test('card images are private to their owner', async () => {
  const path = 'users/alice/cards/c1.jpg';
  await assertSucceeds(uploadBytes(ref(st('alice'), path), bytes(10), JPEG));
  await assertFails(getBytes(ref(st('bob'), path)));
  await assertFails(uploadBytes(ref(st('bob'), path), bytes(10), JPEG));
});
