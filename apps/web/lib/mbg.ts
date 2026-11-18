import type { MbgDaily, MbgForecast, Role } from '@absah/contracts';
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

const longDate = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T00:00:00Z`));

/** One line about the H-3 forecast (RKP-09): computed and sent, or when it will be. */
export function forecastLine(f: MbgForecast, timezone: string): string {
  if (f.status === 'pending') return `Prakiraan untuk ${longDate(f.date)} belum dihitung. Dihitung pukul 13.00 tiga hari sebelumnya, bila hari itu hari sekolah.`;
  const at = f.computedAt ? ` pukul ${clock(timeIn(timezone, f.computedAt))}` : '';
  return `Prakiraan untuk ${longDate(f.date)}, dihitung${at}${f.sentAt ? ' dan terkirim ke PIC' : '. Belum ada nomor PIC, jadi tidak dikirim'}.`;
}
