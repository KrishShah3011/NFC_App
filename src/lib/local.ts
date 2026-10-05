import { File, Paths } from 'expo-file-system';
import { emptyInbox, type InboxState } from './inbox';
import type { Settings } from './types';

// Device-only state; never synced (spec §6.2).
export type Local = {
  settings: Settings;
  inbox: InboxState;
  uploads: { cardId: string; uri: string }[];
  lastOpenAt: number;
  lastFullRefresh: number;
};

const defaults = (): Local => ({
  settings: { saveToContacts: true, location: true },
  inbox: emptyInbox(),
  uploads: [],
  lastOpenAt: 0,
  lastFullRefresh: 0,
});

const file = new File(Paths.document, 'local.json');
const listeners = new Set<() => void>();
let cache: Local | null = null;

export function readLocal(): Local {
  if (!cache) {
    try {
      cache = { ...defaults(), ...(file.exists ? JSON.parse(file.textSync()) : {}) };
    } catch {
      cache = defaults();
    }
  }
  return cache as Local;
}

export function writeLocal(patch: Partial<Local>): Local {
  cache = { ...readLocal(), ...patch };
  if (!file.exists) file.create();
  file.write(JSON.stringify(cache));
  listeners.forEach((l) => l());
  return cache;
}

export function subscribeLocal(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** On sign-out: device maps belong to the previous account. */
export function clearLocal() {
  cache = null;
  if (file.exists) file.delete();
  listeners.forEach((l) => l());
}
