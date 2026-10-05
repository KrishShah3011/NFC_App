import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { Linking, Platform } from 'react-native';
import { extra, SCHEME } from './config';
import { nextInbox } from './inbox';
import { readLocal, writeLocal } from './local';
import { normalizePhone } from './qr';
import { fmtDate } from './time';
import type { Card, Fields, Profile } from './types';

// iOS Notes needs Apple's contacts-notes entitlement (spec §7.10).
const notesAllowed = () => Platform.OS === 'android' || extra.contactNotes;

function contactData(f: Fields, note?: string, url?: string) {
  const given = f.name.trim().split(/\s+/);
  const familyName = given.length > 1 ? (given.pop() as string) : '';
  return {
    givenName: given.join(' '),
    familyName,
    company: f.company,
    jobTitle: f.title,
    phones: f.phones.map((number) => ({ label: 'mobile', number })),
    emails: f.emails.map((address) => ({ label: 'work', address })),
    urlAddresses: [...(f.website ? [{ label: 'homepage', url: f.website }] : []), ...(url ? [{ label: 'card', url }] : [])],
    ...(note && notesAllowed() ? { note } : {}),
  };
}

export const contextLine = (c: Pick<Card, 'metAt' | 'place'>, eventName?: string) =>
  ['Met', eventName && `at ${eventName}`, c.place?.label && `(${c.place.label})`, `on ${fmtDate(c.metAt)}`].filter(Boolean).join(' ');

async function canWrite() {
  const p = await getPermissionsAsync();
  return p.granted || (p.canAskAgain && (await requestPermissionsAsync()).granted);
}

const remember = (contactId: string, cardId?: string) => {
  const { inbox } = readLocal();
  writeLocal({
    inbox: { ...inbox, created: [...inbox.created, contactId], linked: cardId ? { ...inbox.linked, [cardId]: contactId } : inbox.linked },
  });
};

export async function saveToPhone(card: Card, eventName?: string): Promise<string | undefined> {
  if (!(await canWrite())) return undefined;
  const c = await Contact.create(contactData(card, contextLine(card, eventName), `${SCHEME}://card/${card.id}`));
  remember(c.id, card.id);
  return c.id;
}

/** Copies the card's current details onto its linked phone contact (keeps the contact's note). */
export async function updatePhone(card: Card): Promise<boolean> {
  const contactId = readLocal().inbox.linked[card.id];
  if (!contactId || !(await canWrite())) return false;
  await new Contact(contactId).patch(contactData(card));
  return true;
}

/** For NameDrop / Tap to Share: the user's own card as a phone contact to set as "My Card". */
export async function saveMyCardToPhone(p: Profile): Promise<boolean> {
  if (!(await canWrite())) return false;
  remember((await Contact.create(contactData(p))).id);
  return true;
}

/** Refreshes the inbox. false = no full contacts access (inbox disabled, spec §7.5). */
export async function checkInbox(): Promise<boolean> {
  const perm = await getPermissionsAsync();
  if (!perm.granted || (perm.accessPrivileges && perm.accessPrivileges !== 'all')) return false;
  const ids = (await Contact.getAll()).map((c) => c.id);
  const local = readLocal();
  const now = Date.now();
  writeLocal({ inbox: { ...local.inbox, ...nextInbox(ids, local.inbox, local.lastOpenAt || now, now) }, lastOpenAt: now });
  return true;
}

export async function requestFullContacts(): Promise<'all' | 'limited' | 'denied'> {
  const p = await requestPermissionsAsync();
  if (!p.granted) return 'denied';
  if (p.accessPrivileges === 'limited') {
    await Linking.openSettings();
    return 'limited';
  }
  return 'all';
}

export async function inboxContactFields(id: string): Promise<Fields> {
  const d = await new Contact(id).getDetails([
    ContactField.GIVEN_NAME,
    ContactField.FAMILY_NAME,
    ContactField.COMPANY,
    ContactField.JOB_TITLE,
    ContactField.PHONES,
    ContactField.EMAILS,
    ContactField.URL_ADDRESSES,
  ]);
  return {
    name: [d.givenName, d.familyName].filter(Boolean).join(' '),
    title: d.jobTitle ?? '',
    company: d.company ?? '',
    phones: (d.phones ?? []).map((p) => normalizePhone(p.number ?? '') ?? p.number ?? '').filter(Boolean),
    emails: (d.emails ?? []).map((e) => e.address ?? '').filter(Boolean),
    website: d.urlAddresses?.[0]?.url ?? '',
    address: '',
  };
}

/** Accept (link to card) or dismiss an inbox item. */
export function resolveInbox(contactId: string, cardId?: string) {
  const { inbox } = readLocal();
  writeLocal({
    inbox: {
      ...inbox,
      pending: inbox.pending.filter((p) => p.id !== contactId),
      ...(cardId ? { linked: { ...inbox.linked, [cardId]: contactId } } : { dismissed: [...inbox.dismissed, contactId] }),
    },
  });
}
