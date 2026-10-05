import { waitForPendingWrites } from '@react-native-firebase/firestore';
import { deleteObject, getDownloadURL, putFile, ref } from '@react-native-firebase/storage';
import { Directory, File, Paths } from 'expo-file-system';
import { updateCard } from './data';
import { auth, db, storage } from './firebase';
import { readLocal, writeLocal } from './local';
import type { Card } from './types';

// Storage uploads don't queue offline, so we keep our own queue (spec §9).
const dir = new Directory(Paths.document, 'cards');
const localFile = (cardId: string) => new File(dir, `${cardId}.jpg`);

export const MAX_CARD_IMAGE = 5 * 1024 * 1024; // matches storage.rules

/** Throws (non-retryable) if the photo is over the Storage limit; the card itself stays saved. */
export async function queueCardImage(cardId: string, uri: string): Promise<void> {
  if (new File(uri).size > MAX_CARD_IMAGE) throw new Error('Card photo is over 5 MB, so it was not attached. The card is saved.');
  if (!dir.exists) dir.create();
  const dest = localFile(cardId);
  await new File(uri).copy(dest);
  updateCard(cardId, { cardImagePath: dest.uri });
  writeLocal({ uploads: [...readLocal().uploads.filter((u) => u.cardId !== cardId), { cardId, uri: dest.uri }] });
  void flushUploads();
}

let flushing = false;
export async function flushUploads(): Promise<void> {
  const user = auth.currentUser;
  if (flushing || !user) return;
  flushing = true;
  try {
    for (const u of readLocal().uploads) {
      const path = `users/${user.uid}/cards/${u.cardId}.jpg`;
      try {
        await putFile(ref(storage, path), u.uri, { contentType: 'image/jpeg' });
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'storage/unauthorized' || code === 'storage/invalid-argument') {
          // Permanent rejection: stop retrying; the photo stays viewable on this device.
          writeLocal({ uploads: readLocal().uploads.filter((x) => x.cardId !== u.cardId) });
          continue;
        }
        break; // offline or transient: retry on next foreground / 30 s tick
      }
      updateCard(u.cardId, { cardImagePath: path });
      writeLocal({ uploads: readLocal().uploads.filter((x) => x.cardId !== u.cardId) });
    }
  } finally {
    flushing = false;
  }
}

export async function cardImageUri(c: Card): Promise<string | undefined> {
  if (!c.cardImagePath) return undefined;
  const f = localFile(c.id);
  if (f.exists) return f.uri;
  if (!c.cardImagePath.startsWith('users/')) return undefined; // still queued on another device
  return getDownloadURL(ref(storage, c.cardImagePath)).catch(() => undefined);
}

export function deleteCardImage(c: Card) {
  const f = localFile(c.id);
  if (f.exists) f.delete();
  writeLocal({ uploads: readLocal().uploads.filter((u) => u.cardId !== c.id) });
  if (c.cardImagePath?.startsWith('users/')) deleteObject(ref(storage, c.cardImagePath)).catch(() => {});
}

/** Needs the profile doc on the server first (Storage rule checks ownership), so it requires a connection. */
export async function uploadProfilePhoto(slug: string, uri: string): Promise<string> {
  if (new File(uri).size > 2 * 1024 * 1024) throw new Error('Photo must be under 2 MB. Pick a smaller one.');
  await Promise.race([
    waitForPendingWrites(db),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("You're offline. Try again with a connection.")), 10000)),
  ]);
  const r = ref(storage, `profiles/${slug}.jpg`);
  await putFile(r, uri, { contentType: 'image/jpeg' });
  return getDownloadURL(r);
}
