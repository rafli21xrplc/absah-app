import { EXAM_CARD_HOLDERS, EXAM_MANAGERS, EXAM_VIEWERS } from '@absah/contracts';
import type { EligibilityReason, ExamPeriod, Role } from '@absah/contracts';
import { dateLabel } from './billing';

/** Role lists come from the contracts, the same constants the API's policies are built from. */
export const EXAM_MANAGING: Role[] = [...EXAM_MANAGERS];
export const EXAM_VIEWING: Role[] = [...EXAM_VIEWERS];
export const EXAM_CARD_HOLDING: Role[] = [...EXAM_CARD_HOLDERS];

/** The reason a student may not sit, in words a wali kelas can say to a parent; never an amount. */
export function reasonLabel(reason: EligibilityReason): string {
  if (reason.kind === 'attendance') return `Kehadiran ${String(reason.percent).replace('.', ',')}% (minimal ${reason.minimum}%)`;
  return reason.unpaidInstallments === 1 ? '1 cicilan belum lunas' : `${reason.unpaidInstallments} cicilan belum lunas`;
}

/** "1 Desember 2026" for one day, "1–5 Desember 2026" within a month, "30 November–2 Desember 2026" across months. */
export function examWindowLabel(startsOn: string, endsOn: string): string {
  if (startsOn === endsOn) return dateLabel(startsOn);
  const [sy, sm, sd] = startsOn.split('-');
  const [ey, em] = endsOn.split('-');
  if (sy === ey && sm === em) return `${Number(sd)}–${dateLabel(endsOn)}`;
  if (sy === ey) return `${dateLabel(startsOn).replace(` ${sy}`, '')}–${dateLabel(endsOn)}`;
  return `${dateLabel(startsOn)}–${dateLabel(endsOn)}`;
}

/** The rule of a period as one line the wakasek can check at a glance. */
export function ruleSummary(period: Pick<ExamPeriod, 'minAttendance' | 'excusedCounts' | 'requirePaid' | 'feeTypeIds'>): string {
  const parts: string[] = [];
  if (period.minAttendance !== null) parts.push(`Kehadiran minimal ${period.minAttendance}% (${period.excusedCounts ? 'sakit dan izin dihitung hadir' : 'sakit dan izin tidak dihitung'})`);
  if (period.requirePaid) parts.push(period.feeTypeIds.length > 0 ? `Tagihan terpilih (${period.feeTypeIds.length} jenis) harus lunas` : 'Semua tagihan yang jatuh tempo harus lunas');
  return parts.length > 0 ? parts.join(' · ') : 'Semua siswa boleh ujian (belum ada syarat)';
}

const CHECKIN_PROBLEMS: Record<string, string> = {
  period_closed: 'Ujian ini sudah ditutup.',
  not_exam_day: 'Hari ini bukan hari ujian ini.',
  not_seated: 'Siswa ini belum punya tempat di ruang mana pun.',
  not_eligible: 'Siswa ini belum boleh ujian.',
  malformed: 'Kode QR bukan kartu Absah.',
  expired: 'Kode QR sudah kedaluwarsa; minta siswa membuka kartunya lagi.',
  no_key: 'Kartu belum bisa diperiksa; minta siswa membuka kartunya lagi.',
  bad_signature: 'Kartu tidak sah.',
  unknown_card: 'Kartu tidak dikenal.',
  wrong_device: 'Kartu ini sudah dipindah ke HP lain.',
};

/** What the pengawas reads when a check-in is refused: the API's reason (and the room or the card's reason), in words. */
export function checkInProblem(details: { reason?: string; room?: string; cardReason?: string; reasons?: string[] } | undefined): string {
  if (!details?.reason) return 'Tidak bisa mencatat kedatangan.';
  if (details.reason === 'wrong_room') return `Siswa ini duduk di ruang ${details.room ?? 'lain'}.`;
  if (details.reason === 'card_rejected') return CHECKIN_PROBLEMS[details.cardReason ?? ''] ?? 'Kartu tidak bisa dibaca.';
  return CHECKIN_PROBLEMS[details.reason] ?? 'Tidak bisa mencatat kedatangan.';
}

export interface PeriodForm {
  name: string;
  startsOn: string;
  endsOn: string;
  useMin: boolean;
  minText: string;
  attendanceFrom: string;
  excusedCounts: boolean;
  requirePaid: boolean;
  feeTypeIds: string[];
}

export const EMPTY_PERIOD_FORM: PeriodForm = { name: '', startsOn: '', endsOn: '', useMin: true, minText: '75', attendanceFrom: '', excusedCounts: true, requirePaid: false, feeTypeIds: [] };

export function formFromPeriod(p: ExamPeriod): PeriodForm {
  return {
    name: p.name,
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    useMin: p.minAttendance !== null,
    minText: p.minAttendance === null ? '75' : String(p.minAttendance),
    attendanceFrom: p.attendanceFrom ?? '',
    excusedCounts: p.excusedCounts,
    requirePaid: p.requirePaid,
    feeTypeIds: p.feeTypeIds,
  };
}

/** Problems with the period form before it is sent, as the message to show, or null (the API checks the same). */
export function periodProblem(f: PeriodForm): string | null {
  if (f.name.trim().length < 2) return 'Nama ujian minimal 2 huruf.';
  if (!f.startsOn || !f.endsOn) return 'Isi tanggal mulai dan selesai.';
  if (f.endsOn < f.startsOn) return 'Tanggal selesai sebelum tanggal mulai.';
  if (f.useMin) {
    const n = Number(f.minText);
    if (!Number.isInteger(n) || n < 1 || n > 100) return 'Kehadiran minimal harus bilangan bulat 1 sampai 100 persen.';
  }
  if (f.attendanceFrom && f.attendanceFrom > f.startsOn) return 'Penghitungan kehadiran harus dimulai sebelum ujian.';
  return null;
}

/** The request body: no attendance rule when unticked, fee types only when the paid rule is on. */
export function periodBody(f: PeriodForm) {
  return {
    name: f.name.trim(),
    startsOn: f.startsOn,
    endsOn: f.endsOn,
    minAttendance: f.useMin ? Number(f.minText) : null,
    attendanceFrom: f.attendanceFrom || null,
    excusedCounts: f.excusedCounts,
    requirePaid: f.requirePaid,
    feeTypeIds: f.requirePaid ? f.feeTypeIds : [],
  };
}

export type ExamCardView = 'over' | 'arrived' | 'before' | 'blocked' | 'show';

/** What the student's exam card shows today (a school date, YYYY-MM-DD): the QR only on an exam day, only to someone who may sit. */
export function examCardView(exam: { period: { startsOn: string; endsOn: string }; eligible: boolean; arrived: boolean }, today: string): ExamCardView {
  if (today > exam.period.endsOn) return 'over';
  if (exam.arrived) return 'arrived';
  if (today < exam.period.startsOn) return 'before';
  return exam.eligible ? 'show' : 'blocked';
}
