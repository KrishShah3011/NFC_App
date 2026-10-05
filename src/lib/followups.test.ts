import * as Notifications from 'expo-notifications';
import { MAX_SCHEDULED, dueToday, followUpSignature, rescheduleAll } from './followups';
import type { Card } from './types';

jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const NOW = 1_000_000;
const c = (id: string, dueAt: number, done = false): Card =>
  ({ id, name: id, company: '', followUp: { dueAt, note: '', done } }) as unknown as Card;

beforeEach(() => {
  jest.clearAllMocks();
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockImplementation(async () => {});
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async () => 'id');
});

test('schedules only future, not-done follow-ups, soonest first, capped for iOS', async () => {
  const many = Array.from({ length: 70 }, (_, i) => c(`f${i}`, NOW + (70 - i) * 1000));
  await rescheduleAll([...many, c('past', NOW - 1), c('done', NOW + 5, true)], NOW);
  const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(calls).toHaveLength(MAX_SCHEDULED);
  expect(calls[0][0].content.data.url).toBe('/card/f69');
  expect(calls[0][0].trigger).toEqual({ type: 'date', date: new Date(NOW + 1000) });
});

test('overlapping runs are serialised: cancel, schedule..., cancel, schedule...', async () => {
  const order: string[] = [];
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockImplementation(async () => void order.push('cancel'));
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async () => void order.push('schedule'));
  const list = [c('a', NOW + 10), c('b', NOW + 20)];
  await Promise.all([rescheduleAll(list, NOW), rescheduleAll(list, NOW)]);
  expect(order).toEqual(['cancel', 'schedule', 'schedule', 'cancel', 'schedule', 'schedule']);
});

test('rescheduling twice is idempotent (cancel then reschedule)', async () => {
  const list = [c('a', NOW + 10), c('b', NOW + 20)];
  await rescheduleAll(list, NOW);
  await rescheduleAll(list, NOW);
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
});

test('dueToday and signature', () => {
  const list = [c('a', NOW - 10), c('b', NOW + 365 * 86400000), c('d', NOW, true)];
  expect(dueToday(list, NOW).map((x) => x.id)).toEqual(['a']);
  expect(followUpSignature(list)).toBe(followUpSignature([...list].reverse()));
  expect(followUpSignature(list)).not.toBe(followUpSignature([c('a', NOW - 9)]));
});
