'use client';

import { TracerAlumniList, TracerClassList, TracerRecap } from '@absah/contracts';
import { Button, Select } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { PKL_MANAGERS } from '@/lib/pkl';
import { STREAM_LABELS } from '@/lib/report';
import { answerText, percentText, SOURCE_LABELS } from '@/lib/tracer';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import { AlumnusActions, ManagePanel } from './manage';

/** Tracer study (PKL-05): the BMW recap per angkatan and jurusan, the alumni with their answers, and (BKK) adding, inviting, entering. */
export default function TracerPage() {
  const { schoolId, hasRole } = useWorkspace();
  const manager = hasRole(...PKL_MANAGERS);
  const [recap, setRecap] = useState<TracerRecap | null>(null);
  const [alumni, setAlumni] = useState<TracerAlumniList['items'] | null>(null);
  const [classes, setClasses] = useState<TracerClassList['items']>([]);
  const [year, setYear] = useState<number | ''>('');
  const [answered, setAnswered] = useState<'' | 'yes' | 'no'>('');
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    if (!schoolId) return;
    const query = new URLSearchParams();
    if (year !== '') query.set('graduationYear', String(year));
    if (answered) query.set('answered', answered);
    const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : 'Data alumni belum termuat. Muat ulang halaman.');
    api('/tracer/recap', TracerRecap, { schoolId }).then(setRecap).catch(fail);
    api(`/tracer/alumni${query.size ? `?${query}` : ''}`, TracerAlumniList, { schoolId })
      .then((r) => setAlumni(r.items))
      .catch(fail);
    if (manager) {
      api('/tracer/classes', TracerClassList, { schoolId })
        .then((r) => setClasses(r.items))
        .catch(() => undefined);
    }
  }, [schoolId, year, answered, manager]);
  useEffect(load, [load]);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/tracer/export.xlsx', { headers: { 'x-school-id': schoolId ?? '' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error('download failed');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'tracer-study.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError('Berkas tidak bisa diunduh. Coba lagi.');
    } finally {
      setDownloading(false);
    }
  }

  const years = [...new Set(recap?.rows.map((r) => r.graduationYear) ?? [])];
  return (
    <IfCap name="pkl.tracer" fallback={<p className={styles.main}>Tracer study belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/pkl">
          ← PKL
        </Link>
        <h1 className={styles.title}>Tracer study alumni</h1>
        {error && <p role="alert">{error}</p>}

        <section className={styles.section} aria-labelledby="rekap">
          <h2 id="rekap">Rekap BMW</h2>
          <p className={styles.muted}>BMW = bekerja, melanjutkan studi, atau wirausaha, dari alumni yang sudah mengisi.</p>
          {!recap && !error && <p role="status">Memuat…</p>}
          {recap && recap.rows.length === 0 && <p className={styles.empty}>Belum ada alumni. Tambahkan alumni atau salin dari rombel.</p>}
          {recap && recap.rows.length > 0 && (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Angkatan</th>
                      <th>Jurusan</th>
                      <th className={styles.num}>Alumni</th>
                      <th className={styles.num}>Mengisi</th>
                      <th className={styles.num}>Bekerja</th>
                      <th className={styles.num}>Melanjutkan</th>
                      <th className={styles.num}>Wirausaha</th>
                      <th className={styles.num}>Belum</th>
                      <th className={styles.num}>BMW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.rows.map((r) => (
                      <tr key={`${r.graduationYear}-${r.stream ?? ''}`}>
                        <td>{r.graduationYear}</td>
                        <td>{r.stream ? STREAM_LABELS[r.stream] : '–'}</td>
                        <td className={styles.num}>{r.total}</td>
                        <td className={styles.num}>{r.answered}</td>
                        <td className={styles.num}>{r.counts.bekerja}</td>
                        <td className={styles.num}>{r.counts.melanjutkan}</td>
                        <td className={styles.num}>{r.counts.wirausaha}</td>
                        <td className={styles.num}>{r.counts.belum}</td>
                        <td className={styles.num}>{percentText(r.bmwPercent)}</td>
                      </tr>
                    ))}
                    <tr>
                      <th colSpan={2}>Semua</th>
                      <td className={styles.num}>{recap.totals.total}</td>
                      <td className={styles.num}>{recap.totals.answered}</td>
                      <td className={styles.num}>{recap.totals.counts.bekerja}</td>
                      <td className={styles.num}>{recap.totals.counts.melanjutkan}</td>
                      <td className={styles.num}>{recap.totals.counts.wirausaha}</td>
                      <td className={styles.num}>{recap.totals.counts.belum}</td>
                      <td className={styles.num}>
                        <strong>{percentText(recap.totals.bmwPercent)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className={styles.toolbar}>
                <Button variant="secondary" disabled={downloading} onClick={() => void download()}>
                  {downloading ? 'Menyiapkan…' : 'Unduh Excel'}
                </Button>
              </div>
            </>
          )}
        </section>

        {manager && schoolId && <ManagePanel schoolId={schoolId} classes={classes} years={years} onChanged={load} />}

        <section className={styles.section} aria-labelledby="alumni">
          <h2 id="alumni">Alumni</h2>
          <div className={styles.toolbar}>
            <label>
              Angkatan{' '}
              <Select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Semua</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Jawaban{' '}
              <Select value={answered} onChange={(e) => setAnswered(e.target.value as '' | 'yes' | 'no')}>
                <option value="">Semua</option>
                <option value="yes">Sudah mengisi</option>
                <option value="no">Belum mengisi</option>
              </Select>
            </label>
          </div>
          {!alumni && !error && <p role="status">Memuat…</p>}
          {alumni && alumni.length === 0 && <p className={styles.empty}>Tidak ada alumni untuk pilihan ini.</p>}
          {alumni && alumni.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Angkatan</th>
                    <th>Jawaban</th>
                    {manager && <th>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {alumni.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.name}
                        {a.stream && <span className={styles.muted}> · {STREAM_LABELS[a.stream]}</span>}
                      </td>
                      <td>{a.graduationYear}</td>
                      <td>
                        {answerText(a)}
                        {a.response && (
                          <>
                            <br />
                            <small className={styles.muted}>{SOURCE_LABELS[a.response.source]}</small>
                          </>
                        )}
                      </td>
                      {manager && schoolId && (
                        <td>
                          <AlumnusActions schoolId={schoolId} alumnus={a} onChanged={load} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </IfCap>
  );
}
