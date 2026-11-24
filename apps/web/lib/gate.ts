import type { Role } from '@absah/contracts';

/** Mirrors absah-api canSeeGateToday / canRecordArrivals / canManageKiosks (the API enforces them). */
export const GATE_VIEWERS: Role[] = ['piket', 'admin', 'operator', 'wakasek', 'kepsek'];
export const ARRIVAL_RECORDERS: Role[] = ['piket', 'admin', 'operator', 'wakasek'];
export const KIOSK_MANAGERS: Role[] = ['admin', 'operator'];

/** "07.12" in the school timezone. */
export const timeIn = (timezone: string, iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** "3 menit lalu", for a kiosk heartbeat. */
export function agoLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return 'belum pernah';
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} jam lalu` : `${Math.round(hours / 24)} hari lalu`;
}

/** The arrival board is polled this often while the tab is visible (GRB-08). */
export const BOARD_POLL_MS = 5_000;
/** Without an answer for this long the board says it may be out of date. */
export const BOARD_STALE_MS = 20_000;

interface BoardRow {
  students: number;
  onTime: number;
  late: number;
  notArrived: number;
  excused: number;
}

/** Students who still need someone to look for them: not in yet and not covered by an approved izin. */
export const toChase = (row: Pick<BoardRow, 'notArrived' | 'excused'>) => Math.max(0, row.notArrived - row.excused);

/** Share of the rombel that is in (on time or late), whole percent; 0 for an empty rombel. */
export const arrivedPercent = (row: Pick<BoardRow, 'students' | 'onTime' | 'late'>) => (row.students === 0 ? 0 : Math.round(((row.onTime + row.late) * 100) / row.students));

/** Rombel with the most students to chase first, then by name (numbers in names compare as numbers). */
export const boardOrder = <T extends BoardRow & { className: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => toChase(b) - toChase(a) || a.className.localeCompare(b.className, 'id', { numeric: true }));

export const boardIsStale = (lastOkAt: number | null, now: number) => lastOkAt === null || now - lastOkAt > BOARD_STALE_MS;
