import { fromBase64Url, parseCardToken, schoolDateAt, verifyCardToken, type KioskDay, type ScanRejectReason } from '@absah/contracts';

export type LocalVerdict =
  | { kind: 'arrived'; outcome: 'on_time' | 'late'; cardId: string; schoolDate: string; firstName: string; className: string }
  | { kind: 'duplicate'; firstName: string; className: string }
  | { kind: 'rejected'; reason: ScanRejectReason };

/** "HH:MM" in the school timezone at ms. */
export const clockAt = (timezone: string, ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));

/** Looks like a card token at all (keyboard-wedge noise and other QR codes are ignored, not queued). */
export const isCardToken = (text: string) => parseCardToken(text.trim()) !== null;

/**
 * The kiosk's own verdict, offline, from the morning download (GRB-03): signature and time with
 * the school-day key, then the roster (bound phone), then the local list of today's arrivals.
 * The server re-checks everything when the queue syncs; its answer is the record.
 */
export async function checkLocally(day: KioskDay, seen: readonly string[], token: string, ms: number): Promise<LocalVerdict> {
  const keys = new Map(day.keys.map((k) => [k.schoolDate, k.key]));
  const check = await verifyCardToken(token.trim(), ms, day.timezone, (d) => {
    const key = keys.get(d);
    return key ? fromBase64Url(key) : null;
  });
  if (!check.ok) return { kind: 'rejected', reason: check.reason };
  const card = day.cards.find((c) => c.cardId === check.cardId);
  if (!card) return { kind: 'rejected', reason: 'unknown_card' };
  if (card.deviceId !== check.deviceId) return { kind: 'rejected', reason: 'wrong_device' };
  const who = { firstName: card.firstName, className: card.className };
  if (seen.includes(card.cardId)) return { kind: 'duplicate', ...who };
  const outcome = clockAt(day.timezone, ms) <= day.lateAfter ? 'on_time' : 'late';
  return { kind: 'arrived', outcome, cardId: card.cardId, schoolDate: schoolDateAt(day.timezone, ms), ...who };
}

/** The download is for one school date; a new day (or no download) means fetch again. */
export const dayIsCurrent = (day: KioskDay | null, ms: number) => day !== null && day.schoolDate === schoolDateAt(day.timezone, ms);
