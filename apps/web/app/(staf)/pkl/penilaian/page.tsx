'use client';

import { PklAssessmentAspectList, PklAssessmentList } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { assessmentNote, overallText, WINDOW_LABELS } from '@/lib/pkl-assessment';
import { PKL_MANAGERS } from '@/lib/pkl';
import { dateRangeLabel } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import { AspectsEditor } from './aspects-editor';

/** Penilaian DUDI (PKL-04): the aspects (managers) and the results the caller may see, as a table and as Excel or PDF. */
export default function PklPenilaianPage() {
  const { schoolId, hasRole } = useWorkspace();
  const manager = hasRole(...PKL_MANAGERS);
  const [results, setResults] = useState<PklAssessmentList['items'] | null>(null);
  const [aspects, setAspects] = useState<PklAssessmentAspectList['items'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'xlsx' | 'pdf' | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/pkl/assessments', PklAssessmentList, { schoolId })
      .then((r) => setResults(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Hasil penilaian belum termuat.'));
    api('/pkl/assessment-aspects', PklAssessmentAspectList, { schoolId })
      .then((r) => setAspects(r.items))
      .catch(() => undefined);
  }, [schoolId]);
  useEffect(load, [load]);

  async function download(format: 'xlsx' | 'pdf') {
    setDownloading(format);
    setError(null);
    try {
      const res = await fetch(`/api/v1/pkl/assessments/export?format=${format}`, { headers: { 'x-school-id': schoolId ?? '' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error('download failed');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `penilaian-dudi.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError('Berkas tidak bisa diunduh. Coba lagi.');
    } finally {
      setDownloading(null);
    }
  }

  const assessed = results?.filter((r) => r.assessment).length ?? 0;
  return (
    <IfCap name="pkl.enabled" fallback={<p className={styles.main}>PKL belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/pkl">
          ← PKL
        </Link>
        <h1 className={styles.title}>Penilaian DUDI</h1>
        {error && <p role="alert">{error}</p>}
        {manager && schoolId && aspects && <AspectsEditor schoolId={schoolId} aspects={aspects} onSaved={load} />}

        <section className={styles.section} aria-labelledby="hasil">
          <h2 id="hasil">Hasil penilaian</h2>
          {!results && !error && <p role="status">Memuat…</p>}
          {results && results.length === 0 && <p className={styles.empty}>Belum ada penempatan PKL yang bisa Anda lihat.</p>}
          {results && results.length > 0 && (
            <>
              <p className={styles.muted}>
                {assessed} dari {results.length} siswa sudah dinilai.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Siswa</th>
                      <th>DUDI</th>
                      <th>Periode</th>
                      <th>Pengisian</th>
                      <th className={styles.num}>Nilai akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.placementId}>
                        <td>
                          {r.student.name}
                          <span className={styles.muted}> · {r.student.className}</span>
                        </td>
                        <td>{r.partner.name}</td>
                        <td>{dateRangeLabel(r.startsOn, r.endsOn)}</td>
                        <td>
                          {WINDOW_LABELS[r.window]}
                          <br />
                          <small className={styles.muted}>{assessmentNote(r)}</small>
                        </td>
                        <td className={styles.num}>{overallText(r.assessment?.overall)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.toolbar}>
                <Button variant="secondary" disabled={downloading !== null} onClick={() => void download('xlsx')}>
                  {downloading === 'xlsx' ? 'Menyiapkan…' : 'Unduh Excel'}
                </Button>
                <Button variant="secondary" disabled={downloading !== null} onClick={() => void download('pdf')}>
                  {downloading === 'pdf' ? 'Menyiapkan…' : 'Unduh PDF'}
                </Button>
              </div>
            </>
          )}
        </section>
      </main>
    </IfCap>
  );
}
