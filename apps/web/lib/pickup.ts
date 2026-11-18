import type { PickupEventStatus, PickupGuardianStatus, PickupRelation, Role } from '@absah/contracts';

/** Mirror absah-api canSeeGateToday: they see every check-out of the day; a wali kelas sees their rombel. */
export const PICKUP_DAY_VIEWERS: Role[] = ['piket', 'admin', 'operator', 'wakasek', 'kepsek'];

export const RELATION_LABELS: Record<PickupRelation, string> = {
  ayah: 'Ayah',
  ibu: 'Ibu',
  kakek: 'Kakek',
  nenek: 'Nenek',
  kakak: 'Kakak',
  paman: 'Paman',
  bibi: 'Bibi',
  sopir: 'Sopir / ojek langganan',
  lainnya: 'Lainnya',
};
export const RELATIONS = Object.keys(RELATION_LABELS) as PickupRelation[];

export const GUARDIAN_STATUS_LABELS: Record<PickupGuardianStatus, string> = {
  pending: 'Menunggu persetujuan wali kelas',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  inactive: 'Nonaktif',
};

export const EVENT_STATUS_LABELS: Record<PickupEventStatus, string> = {
  released: 'Sudah pulang',
  held: 'Menunggu persetujuan',
  denied: 'Ditolak',
  expired: 'Kedaluwarsa',
};

/** Longest side of a penjemput photo; keeps a phone camera picture well under the 2 MB limit. */
export const PHOTO_MAX_SIDE = 960;

/** Width and height scaled down so the longest side is at most `max` (never scaled up). */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** A chosen picture as a JPEG the API accepts (browser only). */
export async function toJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('jpeg_failed');
  return blob;
}

/** PUTs the photo to the presigned URL the API handed out. */
export async function putPhoto(upload: { url: string; headers: Record<string, string> }, photo: Blob, put: typeof fetch = fetch): Promise<void> {
  const res = await put(upload.url, { method: 'PUT', headers: upload.headers, body: photo });
  if (!res.ok) throw new Error(`upload_${res.status}`);
}
