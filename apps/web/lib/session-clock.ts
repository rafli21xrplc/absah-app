/**
 * The clock of the "Hari ini" screen. Pure functions, tested: which session is in progress is decided from the SERVER's
 * time (a phone's clock may be minutes off), read in the school's own time zone.
 */

/** What the screen needs to know about a session to place it. */
export interface ClockSession {
  status: 'open' | 'submitted' | 'missed' | 'locked';
  /** Lesson time ("HH:MM", school time); null for a daily or activity session. */
  period: { startsAt: string; endsAt: string } | null;
}

export interface TodayGroups<T> {
  /** In progress now, or open all day (daily and activity sessions). */
  current: T[];
  /** Their time is over and they are still open: they can be filled until the end of the day. */
  unfilled: T[];
  /** Not started yet. */
  next: T[];
  /** Submitted, locked or missed. */
  done: T[];
}

/** "08:30" -> 510. Anything that is not HH:MM gives NaN, which no comparison matches. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
}

/** Minutes since midnight at `instant` in `timeZone` (an IANA name such as Asia/Makassar). */
export function minutesOfDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get('hour') * 60 + get('minute');
}

export type Phase = 'before' | 'during' | 'after' | 'untimed';

/** A lesson is "during" from its start up to, but not including, its end: at 09:15 the 08:30–09:15 lesson is over. */
export function phaseOf(period: ClockSession['period'], nowMinutes: number): Phase {
  if (!period) return 'untimed';
  const start = toMinutes(period.startsAt);
  const end = toMinutes(period.endsAt);
  if (nowMinutes < start) return 'before';
  if (nowMinutes < end) return 'during';
  return 'after';
}

const byStart = (a: ClockSession, b: ClockSession) => {
  const x = a.period ? toMinutes(a.period.startsAt) : Number.POSITIVE_INFINITY;
  const y = b.period ? toMinutes(b.period.startsAt) : Number.POSITIVE_INFINITY;
  return x === y ? 0 : x < y ? -1 : 1;
};

/** Splits today's sessions into the four groups of the screen. Each group is in lesson order. The status is the API's own. */
export function groupToday<T extends ClockSession>(sessions: readonly T[], nowMinutes: number): TodayGroups<T> {
  const out: TodayGroups<T> = { current: [], unfilled: [], next: [], done: [] };
  for (const s of [...sessions].sort(byStart)) {
    if (s.status !== 'open') out.done.push(s);
    else {
      const phase = phaseOf(s.period, nowMinutes);
      if (phase === 'before') out.next.push(s);
      else if (phase === 'after') out.unfilled.push(s);
      else out.current.push(s);
    }
  }
  return out;
}

export type GreetingPart = 'morning' | 'noon' | 'afternoon' | 'night';

/** Pagi 04.00–10.59, siang 11.00–14.59, sore 15.00–17.59, otherwise malam. */
export function greetingPart(nowMinutes: number): GreetingPart {
  if (nowMinutes >= 4 * 60 && nowMinutes < 11 * 60) return 'morning';
  if (nowMinutes >= 11 * 60 && nowMinutes < 15 * 60) return 'noon';
  if (nowMinutes >= 15 * 60 && nowMinutes < 18 * 60) return 'afternoon';
  return 'night';
}

const HONORIFICS = new Set(['bu', 'ibu', 'pak', 'bapak', 'dr', 'dr.', 'drs', 'drs.', 'dra', 'dra.', 'h', 'h.', 'hj', 'hj.', 'prof', 'prof.', 'ir', 'ir.']);

/**
 * The name to greet: no academic degree after a comma, no honorific, first word. We do not add "Bu" or "Pak": the app does
 * not know which one a person wants, and a wrong guess is worse than a plain first name.
 */
export function greetingName(fullName: string): string {
  const words = (fullName.split(',')[0] ?? '').trim().split(/\s+/).filter(Boolean);
  const first = words.find((w) => !HONORIFICS.has(w.toLowerCase())) ?? words[0] ?? '';
  return first.length > 1 && first === first.toUpperCase() ? first.charAt(0) + first.slice(1).toLowerCase() : first;
}

/** Server time minus device time, in ms, from the HTTP `Date` header. null when the header is missing or unreadable. */
export function clockOffset(dateHeader: string | null, deviceNow: number): number | null {
  if (!dateHeader) return null;
  const server = Date.parse(dateHeader);
  return Number.isNaN(server) ? null : server - deviceNow;
}
