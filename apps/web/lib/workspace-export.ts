import { WORKSPACE_EXPORT_RETENTION_DAYS, type WorkspaceExport } from '@absah/contracts';

export const EXPORT_STATUS_LABELS: Record<WorkspaceExport['status'], string> = {
  queued: 'Sedang dibuat',
  done: 'Siap diunduh',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
};

/** While one is being built the list is polled; the admin cannot ask for another one then (the API says 409). */
export const hasQueued = (items: readonly WorkspaceExport[]) => items.some((i) => i.status === 'queued');
export const EXPORT_POLL_MS = 3_000;

/** "12,4 MB", "830 KB": the archive is shown in the unit people expect. */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n);
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${fmt(bytes / (1024 * 1024))} MB`;
  return `${fmt(bytes / (1024 * 1024 * 1024))} GB`;
}

/** The last day a finished file can be downloaded (finished + retention), as an ISO instant. */
export const availableUntil = (finishedAt: string): string => new Date(new Date(finishedAt).getTime() + WORKSPACE_EXPORT_RETENTION_DAYS * 86_400_000).toISOString();

/** One plain line about a row: what is inside, or why there is nothing. */
export function exportSummary(e: WorkspaceExport): string {
  if (e.status === 'queued') return 'Menunggu pekerja menyiapkan berkas. Biasanya beberapa menit.';
  if (e.status === 'failed') return e.error ?? 'Berkas gagal dibuat. Coba minta lagi.';
  if (e.status === 'expired') return 'Berkas sudah dihapus. Minta ekspor baru bila masih perlu.';
  const parts = [`${e.tables ?? 0} tabel`];
  if (e.includeFiles) parts.push(`${e.files ?? 0} berkas`);
  if (e.includesTppk) parts.push('termasuk data TPPK');
  if (e.sizeBytes !== null) parts.push(sizeLabel(e.sizeBytes));
  return parts.join(' · ');
}
