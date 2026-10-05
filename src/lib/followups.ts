import * as Notifications from 'expo-notifications';
import { endOfDay } from './time';
import type { Card } from './types';

export const MAX_SCHEDULED = 60; // iOS keeps at most 64 pending local notifications

const open = (c: Card) => !!c.followUp && !c.followUp.done;

export const upcoming = (cards: Card[], now: number) =>
  cards
    .filter((c) => open(c) && c.followUp!.dueAt > now)
    .sort((a, b) => a.followUp!.dueAt - b.followUp!.dueAt)
    .slice(0, MAX_SCHEDULED);

export const dueToday = (cards: Card[], now: number) => cards.filter((c) => open(c) && c.followUp!.dueAt < endOfDay(now));

/** Changes only when a follow-up is added, moved, completed or removed. */
export const followUpSignature = (cards: Card[]) =>
  cards
    .filter(open)
    .map((c) => `${c.id}:${c.followUp!.dueAt}`)
    .sort()
    .join('|');

async function run(cards: Card[], now: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const c of upcoming(cards, now)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: `Follow up: ${c.name || 'contact'}`, body: c.followUp!.note || c.company || '', data: { url: `/card/${c.id}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(c.followUp!.dueAt) },
    });
  }
}

let chain: Promise<void> = Promise.resolve();

/** Idempotent and serialised: each run cancels everything, then schedules the soonest MAX_SCHEDULED.
 *  Overlapping calls queue up, so two runs never interleave their cancel/schedule steps. */
export function rescheduleAll(cards: Card[], now = Date.now()): Promise<void> {
  chain = chain.then(() => run(cards, now)).catch(() => {});
  return chain;
}

/** Ask just in time (first follow-up). iOS and Android 13+ start with notifications off. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return true;
  return p.canAskAgain ? (await Notifications.requestPermissionsAsync()).granted : false;
}
