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
