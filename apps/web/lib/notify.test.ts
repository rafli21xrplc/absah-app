import { NOTIFICATION_STATUSES, TEMPLATE_CODES } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { errorLabel, STATUS_LABELS, TEMPLATE_LABELS } from './notify';

describe('notify labels', () => {
  it('covers every status and template', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...NOTIFICATION_STATUSES].sort());
    expect(Object.keys(TEMPLATE_LABELS).sort()).toEqual([...TEMPLATE_CODES].sort());
  });

  it('explains common failures in plain words', () => {
    expect(errorLabel('wa_131026')).toBe('Nomor tidak bisa menerima WhatsApp');
    expect(errorLabel('http_400:131026')).toBe('Nomor tidak bisa menerima WhatsApp');
    expect(errorLabel('http_429:130429')).toBe('Batas kirim WhatsApp tercapai');
    expect(errorLabel('template_not_approved')).toBe('Template belum disetujui WhatsApp');
    expect(errorLabel(null)).toBe('Tidak diketahui');
  });
});
