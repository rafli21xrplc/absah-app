import type { MbgDaily, Role } from '@absah/contracts';
import { timeIn } from './gate';

/** Mirror absah-api MBG policies (the API enforces them). */
export const MBG_READERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek'];
export const MBG_MANAGERS: Role[] = ['admin'];

/** "08:30" -> "08.30", the Indonesian way of writing a time. */
export const clock = (time: string) => time.replace(':', '.');

/** One line under the MBG numbers: what they are and whether the PIC has them. */
export function mbgStatusLine(daily: MbgDaily, timezone: string): string {
  if (daily.status === 'not_school_day') return 'Bukan hari sekolah: tidak ada laporan MBG.';
  if (daily.status === 'pending') return `Angka sementara. Dihitung dan dikirim ke PIC pukul ${clock(daily.cutoffTime)}.`;
  const counted = daily.countedAt ? `Dihitung pukul ${clock(timeIn(timezone, daily.countedAt))}` : 'Sudah dihitung';
  return daily.sentAt ? `${counted}, terkirim ke PIC.` : `${counted}. Belum ada nomor PIC, jadi tidak dikirim.`;
}
