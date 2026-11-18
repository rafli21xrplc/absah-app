'use client';

import { CreateImportResponse, StudentImportList, StudentImportResponse, XLSX_CONTENT_TYPE, IMPORT_MAX_BYTES } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { STUDENT_MANAGERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import { ImportPreview } from './preview';

type Import = StudentImportResponse;
const POLL_MS = 1500;
const POLL_LIMIT = 120;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wording per data.source: Dapodik (schools) or EMIS (madrasah, AKD-09); same flow behind both. */
const SOURCES = {
  dapodik: { name: 'Dapodik', file: 'Berkas Daftar Peserta Didik (.xlsx)', hint: 'Di Dapodik: menu Peserta Didik, lalu unduh Excel.' },
  emis: { name: 'EMIS', file: 'Berkas data siswa EMIS (.xlsx)', hint: 'Di EMIS: menu Siswa, lalu ekspor data siswa ke Excel.' },
} as const;

/** Student import (AKD-03, AKD-09): upload the export, check the preview, then apply it. */
export default function ImportPage() {
  const { schoolId, hasRole } = useWorkspace();
  const source = useCapability('data.source');
  const allowed = hasRole(...STUDENT_MANAGERS);
  const from = source ?? 'dapodik';
  const words = SOURCES[from];
  const [current, setCurrent] = useState<Import | null>(null);
  const [recent, setRecent] = useState<Import[]>([]);
  const [step, setStep] = useState<'idle' | 'uploading' | 'parsing' | 'committing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const commitKey = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api('/imports', StudentImportList, { schoolId })
      .then((list) => setRecent(list.items))
      .catch(() => undefined);
  }, [schoolId, allowed, current?.status]);

  async function pollUntilParsed(id: string): Promise<Import> {
    for (let i = 0; i < POLL_LIMIT; i++) {
      const imp = await api(`/imports/${id}`, StudentImportResponse, { schoolId });
      if (imp.status !== 'parsing') return imp;
      await wait(POLL_MS);
    }
    throw new Error('timeout');
  }

  async function parse(id: string) {
    setStep('parsing');
    await api(`/imports/${id}/parse`, StudentImportResponse, { method: 'POST', schoolId });
    const imp = await pollUntilParsed(id);
    commitKey.current = null;
    setStale(false);
    setCurrent(imp);
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && (err.body.details as { reason?: string } | undefined)?.reason === 'stale_preview') {
        setStale(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung atau proses terlalu lama. Coba lagi.');
      }
    } finally {
      setStep('idle');
    }
  }

  const upload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError(`Pilih berkas .xlsx hasil ekspor ${words.name}.`);
      return;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      setError('Berkas maksimal 10 MB.');
      return;
    }
    void run(async () => {
      setStep('uploading');
      const contentType = file.type === XLSX_CONTENT_TYPE ? XLSX_CONTENT_TYPE : 'application/octet-stream';
      const created = await api(`/imports/${from}`, CreateImportResponse, {
        method: 'POST',
        body: { fileName: file.name, fileSize: file.size, contentType },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      const put = await fetch(created.upload.url, { method: 'PUT', headers: created.upload.headers, body: file });
      if (!put.ok) throw new Error('upload failed');
      await parse(created.import.id);
    });
  };

  const commit = () => {
    if (!current) return;
    commitKey.current ??= newIdempotencyKey(); // retries of this click reuse the key
    const key = commitKey.current;
    void run(async () => {
      setStep('committing');
      setCurrent(await api(`/imports/${current.id}/commit`, StudentImportResponse, { method: 'POST', schoolId, idempotencyKey: key }));
    });
  };

  if (!allowed) {
    return (
      <main className={styles.main}>
        <p>Import data siswa hanya untuk admin dan operator.</p>
      </main>
    );
  }

  const busyText = { uploading: 'Mengunggah berkas…', parsing: 'Membaca berkas… biasanya kurang dari satu menit.', committing: 'Menerapkan perubahan…' };

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Import data siswa dari {words.name}</h1>

      {(!current || current.status === 'failed' || current.status === 'committed') && (
        <form className={styles.dropzone} onSubmit={upload}>
          <label className={forms.field}>
            <span className={forms.label}>{words.file}</span>
            <input className={forms.input} name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
            <span className={forms.hint}>
              {words.hint} Data yang sudah ada tidak dihapus; Anda melihat pratinjau dulu sebelum menerapkan.
            </span>
          </label>
          <div>
            <Button type="submit" disabled={step !== 'idle'}>
              Unggah dan periksa
            </Button>
          </div>
        </form>
      )}

      {step !== 'idle' && (
        <p role="status" className={styles.notice}>
          {busyText[step]}
        </p>
      )}
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {current?.status === 'failed' && (
        <p className={styles.notice} role="alert">
          Berkas tidak bisa dipakai: {current.error}
        </p>
      )}
      {stale && current && (
        <div className={styles.notice} role="alert">
          <p>Data siswa berubah sejak pratinjau ini dibuat. Muat ulang pratinjau, periksa lagi, lalu terapkan.</p>
          <Button variant="secondary" disabled={step !== 'idle'} onClick={() => void run(() => parse(current.id))}>
            Muat ulang pratinjau
          </Button>
        </div>
      )}

      {current && (current.status === 'ready' || current.status === 'committed') && (
        <ImportPreview imp={current} committing={step === 'committing'} onCommit={commit} onCancel={() => setCurrent(null)} />
      )}

      {!current && recent.length > 0 && (
        <section className={styles.section}>
          <h2>Import terakhir</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Berkas</th>
                  <th>Waktu</th>
                  <th>Status</th>
                  <th className={styles.num}>Baru</th>
                  <th className={styles.num}>Berubah</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fileName}</td>
                    <td>{new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>{{ awaiting_upload: 'Belum diunggah', parsing: 'Dibaca', ready: 'Siap diterapkan', failed: 'Gagal', committed: 'Diterapkan' }[r.status]}</td>
                    <td className={styles.num}>{r.counts?.created ?? '–'}</td>
                    <td className={styles.num}>{r.counts?.changed ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
