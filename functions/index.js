const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

// Wipes everything a user owns (spec §7.11). Order: data first, auth user last, so a retry can finish a partial run.
// ponytail: no emulator test; verified manually via docs/SETUP.md "Deletion check". Add one if this grows.
exports.deleteAccount = onCall({ region: 'asia-south1', enforceAppCheck: true }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const slug = (await userRef.get()).get('profileSlug');
  const bucket = getStorage().bucket();
  if (slug) {
    const profileRef = db.doc(`profiles/${slug}`);
    const p = await profileRef.get();
    if (p.exists && p.get('ownerUid') === uid) {
      await profileRef.delete();
      await bucket.file(`profiles/${slug}.jpg`).delete({ ignoreNotFound: true });
    }
  }
  await db.recursiveDelete(userRef);
  await bucket.deleteFiles({ prefix: `users/${uid}/` });
  await getAuth().deleteUser(uid);
  return { ok: true };
});
