import { API_KEY_MAX_RATE, API_KEY_MIN_RATE, WEBHOOK_URL_MAX, type ApiKey, type ApiKeyScope, type WebhookEventType } from '@absah/contracts';

/** How a key's permission is named to the admin. */
export const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'attendance:read': 'Membaca presensi harian (hanya id dan status, tanpa nama siswa)',
};

/** What a webhook tells the receiver about. Ids and counts only: the receiver asks the open API for more. */
export const EVENT_LABELS: Record<WebhookEventType, string> = {
  'attendance.absent_marked': 'Siswa ditandai alpa',
  'attendance.session_locked': 'Presensi hari itu dikunci (satu kali per hari)',
  'leave.approved': 'Izin siswa disetujui',
  'leave.cancelled': 'Izin siswa yang sudah disetujui dibatalkan',
};

export type KeyState = 'revoked' | 'unused' | 'used';
export const keyState = (k: Pick<ApiKey, 'revokedAt' | 'lastUsedAt'>): KeyState => (k.revokedAt ? 'revoked' : k.lastUsedAt ? 'used' : 'unused');
export const KEY_STATE_LABELS: Record<KeyState, string> = { revoked: 'Dicabut', unused: 'Belum dipakai', used: 'Aktif' };

/** Adds the item when absent, removes it when present; the order of the catalogue is kept by the caller. */
export const toggle = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** "60 per menit": the number the admin typed, or an error in words when it is outside what the API accepts. */
export function parseRate(text: string): { rate: number } | { error: string } {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return { error: 'Isi batas permintaan dengan angka.' };
  const rate = Number(trimmed);
  if (rate < API_KEY_MIN_RATE || rate > API_KEY_MAX_RATE) return { error: `Batas permintaan antara ${API_KEY_MIN_RATE} dan ${API_KEY_MAX_RATE} per menit.` };
  return { rate };
}

/** Checks what the API checks first, so the admin sees the problem before sending. The API stays the judge (private hosts). */
export function webhookInput(url: string, events: readonly WebhookEventType[]): { url: string; events: WebhookEventType[] } | { error: string } {
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return { error: 'Alamat harus diawali https://.' };
  if (trimmed.length > WEBHOOK_URL_MAX) return { error: 'Alamat terlalu panjang.' };
  if (events.length === 0) return { error: 'Pilih minimal satu kejadian.' };
  return { url: trimmed, events: [...events] };
}
