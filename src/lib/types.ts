export type Fields = {
  name: string;
  title: string;
  company: string;
  phones: string[];
  emails: string[];
  website: string;
  address: string;
};

export type Socials = { linkedin?: string; x?: string; instagram?: string; whatsapp?: string };

export type Profile = Fields & { ownerUid: string; socials: Socials; photoUrl: string; updatedAt: number };

export type Place = { lat?: number; lng?: number; label?: string }; // label-only when typed by hand

export type FollowUp = { dueAt: number; note: string; done: boolean };

export type CardSource = 'app' | 'paper' | 'contacts' | 'manual';

export type Card = Fields & {
  id: string;
  source: CardSource;
  profileSlug?: string;
  profileUpdatedAt?: number; // profile.updatedAt of the snapshot; differs => live update available
  pending?: boolean; // scanned offline, details not fetched yet
  unshared?: boolean; // owner deleted the profile; snapshot kept, live updates stop
  photoUrl?: string;
  cardImagePath?: string; // Storage path, or file:// URI while upload is queued
  metAt: number;
  place?: Place;
  eventId?: string;
  notes: string;
  tags: string[];
  followUp?: FollowUp;
  createdAt: number;
  updatedAt: number;
};

export type Event = { id: string; name: string; startsAt: number; endsAt: number; placeLabel?: string };

export type Settings = { saveToContacts: boolean; location: boolean };

export const emptyFields = (): Fields => ({
  name: '',
  title: '',
  company: '',
  phones: [],
  emails: [],
  website: '',
  address: '',
});
