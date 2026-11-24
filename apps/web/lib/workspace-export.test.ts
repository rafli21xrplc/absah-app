import type { WorkspaceExport } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { availableUntil, exportSummary, hasQueued, sizeLabel } from './workspace-export';

const base: WorkspaceExport = { id: '0196a000-0000-7000-8000-000000000001', status: 'done', includeFiles: true, includesTppk: false, fileName: 'data-sekolah-2026-11-23.zip', sizeBytes: 13_002_342, tables: 74, files: 21, error: null, createdAt: '2026-11-23T01:00:00.000Z', finishedAt: '2026-11-23T01:03:00.000Z' };

describe('workspace export helpers (PLT-11)', () => {
  it('prints sizes in the unit people expect', () => {
    expect(sizeLabel(512)).toBe('512 B');
    expect(sizeLabel(2048)).toBe('2 KB');
    expect(sizeLabel(13_002_342)).toBe('12,4 MB');
    expect(sizeLabel(3 * 1024 ** 3)).toBe('3 GB');
  });

  it('summarises each state in one line', () => {
    expect(exportSummary(base)).toBe('74 tabel · 21 berkas · 12,4 MB');
    expect(exportSummary({ ...base, includeFiles: false, includesTppk: true, files: 0 })).toBe('74 tabel · termasuk data TPPK · 12,4 MB');
    expect(exportSummary({ ...base, status: 'queued', tables: null, files: null, sizeBytes: null, finishedAt: null })).toContain('Menunggu');
    expect(exportSummary({ ...base, status: 'failed', error: 'Berkas gagal dibuat. Coba minta ekspor lagi.' })).toBe('Berkas gagal dibuat. Coba minta ekspor lagi.');
    expect(exportSummary({ ...base, status: 'expired' })).toContain('sudah dihapus');
  });

  it('knows when to keep polling and until when a file stays', () => {
    expect(hasQueued([base])).toBe(false);
    expect(hasQueued([base, { ...base, status: 'queued' }])).toBe(true);
    expect(availableUntil('2026-11-23T01:03:00.000Z')).toBe('2026-11-30T01:03:00.000Z');
  });
});
