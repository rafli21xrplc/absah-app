import { MUTABLE_TEMPLATE_CODES, NOTIFICATION_LATE_CUTOFF_MINUTES, type MutableTemplateCode } from '@absah/contracts';

/** What a parent switches on or off (ORT-06). Only these can be switched off; safety messages always arrive. */
export const PREFERENCE_LABELS: Record<MutableTemplateCode, string> = {
  absent_marked: 'Anak tidak hadir tanpa keterangan (alpa)',
  leave_approved: 'Izin disetujui',
  leave_rejected: 'Izin ditolak',
  student_sent_home: 'Anak dipulangkan dari UKS',
  student_picked_up: 'Anak sudah dijemput',
  liaison_message: 'Pesan baru di buku penghubung',
};

/** "19.00": the school time after which a parent who asked for no late messages hears nothing until 06.00. */
export const LATE_CUTOFF_LABEL = `${String(Math.floor(NOTIFICATION_LATE_CUTOFF_MINUTES / 60)).padStart(2, '0')}.${String(NOTIFICATION_LATE_CUTOFF_MINUTES % 60).padStart(2, '0')}`;

/** The checkboxes say "receive", the API stores what is muted: turn a ticked set into the muted list, in catalog order. */
export function mutedFrom(received: ReadonlySet<MutableTemplateCode>): MutableTemplateCode[] {
  return MUTABLE_TEMPLATE_CODES.filter((c) => !received.has(c));
}

export function receivedFrom(muted: readonly MutableTemplateCode[]): Set<MutableTemplateCode> {
  return new Set(MUTABLE_TEMPLATE_CODES.filter((c) => !muted.includes(c)));
}

export function toggled(received: ReadonlySet<MutableTemplateCode>, code: MutableTemplateCode): Set<MutableTemplateCode> {
  const next = new Set(received);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  return next;
}
