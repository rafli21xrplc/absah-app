import type { LiaisonSenderRole } from '@absah/contracts';

export const SENDER_LABELS: Record<LiaisonSenderRole, string> = { orang_tua: 'Orang tua', wali_kelas: 'Wali kelas', guru: 'Guru' };

/** "Hari ini 07.15" / "Kemarin 19.02" / "12 Nov 07.15", in the school timezone. */
export function messageTime(timezone: string, iso: string, now = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat('id-ID', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at).replace(':', '.');
  if (day(at) === day(now)) return `Hari ini ${time}`;
  if (day(at) === day(new Date(now.getTime() - 86_400_000))) return `Kemarin ${time}`;
  return `${new Intl.DateTimeFormat('id-ID', { timeZone: timezone, day: 'numeric', month: 'short' }).format(at)} ${time}`;
}
