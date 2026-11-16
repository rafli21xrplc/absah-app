'use client';

import { ClassList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { STUDENT_MANAGERS, STUDENT_READERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

const STREAM_LABELS: Record<string, string> = { ipa: 'IPA', ips: 'IPS', bahasa: 'Bahasa', keagamaan: 'Keagamaan' };

/** Rombel of the active academic year (AKD-02). */
export default function RombelPage() {
  const { schoolId, hasRole } = useWorkspace();
  const [data, setData] = useState<ClassList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = hasRole(...STUDENT_READERS);

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api('/classes', ClassList, { schoolId })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat rombel.'));
  }, [schoolId, allowed]);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Rombel{data?.academicYear ? ` ${data.academicYear.name}` : ''}</h1>
      {!allowed && <p>Halaman ini untuk admin, operator, dan pimpinan sekolah.</p>}
      {error && <p role="alert">{error}</p>}
      {allowed && !data && !error && <p role="status">Memuat…</p>}
      {data && data.items.length === 0 && (
        <div className={styles.tableWrap}>
          <p className={styles.empty}>
            Belum ada rombel.{' '}
            {hasRole(...STUDENT_MANAGERS) && (
              <>
                Rombel dibuat otomatis saat <Link href="/import">import data siswa</Link>.
              </>
            )}
          </p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rombel</th>
                <th>Kelas</th>
                <th>Wali kelas</th>
                <th className={styles.num}>Siswa</th>
                <th className={styles.num}>Calon keluar</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/siswa?rombel=${c.id}`}>{c.name}</Link>
                  </td>
                  <td>
                    {c.grade}
                    {c.stream ? ` · ${STREAM_LABELS[c.stream] ?? c.stream}` : ''}
                  </td>
                  <td className={c.homeroomTeacher ? undefined : styles.muted}>{c.homeroomTeacher?.name ?? 'Belum ditentukan'}</td>
                  <td className={styles.num}>{c.activeStudents}</td>
                  <td className={styles.num}>
                    {c.missingStudents > 0 ? <span className={styles.badgeWarn}>{c.missingStudents}</span> : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
