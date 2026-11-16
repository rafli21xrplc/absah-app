'use client';

import {
  CreateScheduleImportResponse,
  SCHEDULE_IMPORT_MAX_BYTES,
  ScheduleImportPreview,
  ScheduleImportResult,
  XLSX_CONTENT_TYPE,
} from '@absah/contracts';
import { Button } from '@absah/ui';
import { useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import page from './jadwal.module.css';

type Step = 'idle' | 'downloading' | 'checking' | 'applying';

/** Download the template (current lessons), fill it in Excel, upload, check the preview, apply. */
export function TemplateImport({ onApplied }: { onApplied: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [step, setStep] = useState<Step>('idle');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScheduleImportPreview | null>(null);
  const [done, setDone] = useState<ScheduleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commitKey = useRef<string | null>(null);

  async function run(next: Step, action: () => Promise<void>) {
    setStep(next);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung. Coba lagi.');
    } finally {
      setStep('idle');
    }
  }

  const download = () =>
    run('downloading', async () => {
      const res = await fetch('/api/v1/schedule/template.xlsx', { headers: { 'x-school-id': schoolId ?? '' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error('download failed');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template-jadwal-absah.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });

  const check = (id: string) => async () => {
    commitKey.current = null;
    setPreview(await api(`/schedule/imports/${id}/preview`, ScheduleImportPreview, { method: 'POST', schoolId }));
  };

  const upload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file');
    if (!(file instanceof File) || file.size === 0) return setError('Pilih berkas template jadwal (.xlsx).');
    if (file.size > SCHEDULE_IMPORT_MAX_BYTES) return setError('Berkas maksimal 2 MB.');
    setDone(null);
    void run('checking', async () => {
      const contentType = file.type === XLSX_CONTENT_TYPE ? XLSX_CONTENT_TYPE : 'application/octet-stream';
      const created = await api('/schedule/imports', CreateScheduleImportResponse, {
        method: 'POST',
        body: { fileName: file.name, fileSize: file.size, contentType },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      const put = await fetch(created.upload.url, { method: 'PUT', headers: created.upload.headers, body: file });
      if (!put.ok) throw new Error('upload failed');
      setUploadId(created.uploadId);
      await check(created.uploadId)();
    });
  };

  const apply = () => {
    if (!uploadId || !preview) return;
    commitKey.current ??= newIdempotencyKey();
    const key = commitKey.current;
    void run('applying', async () => {
      try {
        const body = { fingerprint: preview.fingerprint };
        setDone(await api(`/schedule/imports/${uploadId}/commit`, ScheduleImportResult, { method: 'POST', body, schoolId, idempotencyKey: key }));
        setPreview(null);
        setUploadId(null);
        await onApplied();
      } catch (err) {
        // The school data changed since the preview: show the fresh preview instead.
        if (err instanceof ApiError && (err.body.details as { reason?: string } | undefined)?.reason === 'stale_preview') {
          await check(uploadId)();
          throw new ApiError(409, { ...err.body, message: 'Data berubah sejak pratinjau. Periksa pratinjau terbaru, lalu terapkan lagi.' });
        }
        throw err;
      }
    });
  };

  const busyText: Record<Step, string> = { idle: '', downloading: 'Menyiapkan template…', checking: 'Memeriksa berkas…', applying: 'Menerapkan jadwal…' };

  return (
    <section>
      <ol>
        <li>Unduh template. Isinya jadwal saat ini, satu baris per pelajaran.</li>
        <li>Ubah di Excel: Rombel, Hari, Jam ke, Mapel, Guru. Lembar lain berisi daftar rombel, jam, mapel, dan guru.</li>
        <li>Unggah. Rombel yang ada di berkas diganti seluruh jadwalnya; rombel lain tidak berubah.</li>
      </ol>
      <Button type="button" variant="secondary" disabled={step !== 'idle'} onClick={() => void download()}>
        Unduh template
      </Button>

      <form className={`${styles.dropzone} ${page.spaced}`} onSubmit={upload}>
        <label className={forms.field}>
          <span className={forms.label}>Template jadwal yang sudah diisi (.xlsx)</span>
          <input className={forms.input} name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        </label>
        <div>
          <Button type="submit" disabled={step !== 'idle'}>
            Unggah dan periksa
          </Button>
        </div>
      </form>

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

      {preview && (
        <section className={styles.section} aria-label="Pratinjau jadwal">
          <h2>Pratinjau</h2>
          <p>
            {preview.lessons} pelajaran untuk {preview.classes.length} rombel ({preview.classes.join(', ') || '-'}).
            {preview.newSubjects.length > 0 && ` Mapel baru: ${preview.newSubjects.join(', ')}.`}
          </p>
          {preview.errors.length > 0 && (
            <>
              <p className={forms.error}>Perbaiki {preview.errors.length} masalah ini di Excel, lalu unggah lagi.</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.num}>Baris</th>
                      <th>Masalah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((e, i) => (
                      <tr key={i}>
                        <td className={styles.num}>{e.row}</td>
                        <td>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {preview.errors.length === 0 && preview.lessons > 0 && (
            <Button type="button" disabled={step !== 'idle'} onClick={apply}>
              Terapkan jadwal
            </Button>
          )}
        </section>
      )}
      {done && (
        <p className={styles.notice} role="status">
          Jadwal diterapkan: {done.lessons} pelajaran untuk {done.classes.join(', ')}.
        </p>
      )}
    </section>
  );
}
