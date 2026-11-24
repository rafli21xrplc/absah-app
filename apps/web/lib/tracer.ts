import { TracerStatus, TRACER_STATUSES, type ClassStream, type InviteTracerResult, type SaveTracerResponseRequest, type TracerAlumnus } from '@absah/contracts';

export { TRACER_STATUSES };

export const TRACER_STATUS_LABELS: Record<TracerStatus, string> = {
  bekerja: 'Bekerja',
  melanjutkan: 'Melanjutkan studi',
  wirausaha: 'Wirausaha',
  belum: 'Belum bekerja atau melanjutkan',
};

/** What the alumnus names, by status: the company, the campus or the business. */
export const ORGANIZATION_LABELS: Record<Exclude<TracerStatus, 'belum'>, string> = { bekerja: 'Nama perusahaan', melanjutkan: 'Nama kampus', wirausaha: 'Nama usaha' };
export const POSITION_LABELS: Record<Exclude<TracerStatus, 'belum'>, string> = { bekerja: 'Jabatan (boleh dikosongkan)', melanjutkan: 'Program studi (boleh dikosongkan)', wirausaha: 'Bidang usaha (boleh dikosongkan)' };

export const SOURCE_LABELS = { alumni: 'Diisi alumni', bkk: 'Diisi BKK' } as const;

export const STREAM_OPTIONS: { value: ClassStream; label: string }[] = [
  { value: 'ipa', label: 'IPA' },
  { value: 'ips', label: 'IPS' },
  { value: 'bahasa', label: 'Bahasa' },
  { value: 'keagamaan', label: 'Keagamaan' },
];

/** "66,7%" for a BMW share; a dash while nobody has answered. */
export const percentText = (p: number | null | undefined): string => (p == null ? '–' : `${p.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

/** The line under an alumnus: what they answered, or that they have not. */
export function answerText(a: Pick<TracerAlumnus, 'response'>): string {
  const r = a.response;
  if (!r) return 'Belum mengisi';
  const where = [r.organization, r.position].filter(Boolean).join(' · ');
  return where ? `${TRACER_STATUS_LABELS[r.status]}: ${where}` : TRACER_STATUS_LABELS[r.status];
}

/** The body of the answer from what was typed (BKK form and alumni page), or what is missing. "Belum" carries no names. */
export function answerRequest(status: string, organization: string, position: string): { body: SaveTracerResponseRequest } | { error: string } {
  const parsed = TracerStatus.safeParse(status);
  if (!parsed.success) return { error: 'Pilih status Anda.' };
  if (parsed.data === 'belum') return { body: { status: 'belum' } };
  if (!organization.trim()) return { error: `Isi ${ORGANIZATION_LABELS[parsed.data].toLowerCase()}.` };
  return { body: { status: parsed.data, organization: organization.trim(), position: position.trim() || null } };
}

/** The sentence after sending invitations. */
export function inviteSummary(r: InviteTracerResult): string {
  if (r.queued === 0 && r.withoutPhone === 0 && r.alreadyAnswered === 0) return 'Tidak ada alumni yang dipilih.';
  const parts = [`${r.queued} undangan dikirim lewat WhatsApp`];
  if (r.alreadyAnswered > 0) parts.push(`${r.alreadyAnswered} sudah mengisi`);
  if (r.withoutPhone > 0) parts.push(`${r.withoutPhone} tanpa nomor`);
  return `${parts.join(', ')}.`;
}

/** The token in the URL fragment of an alumni link ("<schoolId>.<secret>"), or null. */
export function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim();
  return /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{20,}$/.test(token) ? token : null;
}
