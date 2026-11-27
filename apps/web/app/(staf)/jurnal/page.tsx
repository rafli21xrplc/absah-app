'use client';

import { JournalResponse } from '@absah/contracts';
import { Button, DateInput } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { SESSION_STATUS_LABELS } from '@/lib/attendance';
import { byTeacher, monthIn, monthLabel, shortDate } from '@/lib/journal';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

/**
 * Jurnal mengajar (PRS-09): the topics written when filling each lesson, for one month. A guru sees
 * their own; wakasek, kepsek and admin see every teacher and download one teacher's Excel.
 */
export default function JurnalPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [month, setMonth] = useState(() => monthIn(timezone));
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId || !/^\d{4}-\d{2}$/.test(month)) return;
    api(`/teaching-journal?month=${month}`, JournalResponse, { schoolId })
      .then((j) => {
        setJournal(j);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat jurnal.'));
  }, [schoolId, month]);
  useEffect(load, [load]);

  async function download(teacherId: string) {
    setDownloading(teacherId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/teaching-journal/export.xlsx?month=${month}&teacherId=${teacherId}`, {
        headers: { 'x-school-id': schoolId ?? '' },
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('download failed');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `jurnal-mengajar-${month}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError('Berkas tidak bisa diunduh. Coba lagi.');
    } finally {
      setDownloading(null);
    }
  }

  const groups = journal ? byTeacher(journal.entries) : [];

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Jurnal mengajar</h1>
      <div className={styles.toolbar}>
        <label className={forms.field}>
          Bulan
          <DateInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {journal && (
        <p className={styles.muted}>
          {monthLabel(journal.month)}: {journal.totals.withTopic} dari {journal.totals.sessions} jam pelajaran sudah ada topiknya.
        </p>
      )}
      {journal && journal.entries.length === 0 && <p className={styles.empty}>Belum ada jam pelajaran pada bulan ini.</p>}
      {groups.map((group) => (
        <section key={group.teacher?.id ?? 'none'} className={styles.section}>
          <h2>{group.teacher?.name || 'Tanpa guru'}</h2>
          {group.teacher && (
            <Button variant="secondary" disabled={downloading !== null} onClick={() => void download(group.teacher?.id ?? '')}>
              {downloading === group.teacher.id ? 'Menyiapkan…' : 'Unduh Excel'}
            </Button>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jam</th>
                  <th>Rombel</th>
                  <th>Mapel</th>
                  <th>Topik</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((e) => (
                  <tr key={e.sessionId}>
                    <td>{shortDate(e.schoolDate)}</td>
                    <td>{e.period ? `Ke-${e.period.number}` : ''}</td>
                    <td>{e.className}</td>
                    <td>{e.subject?.name ?? ''}</td>
                    <td>
                      {e.topic ?? (
                        <Link className={styles.muted} href={`/sesi/${e.sessionId}`}>
                          {e.status === 'open' ? 'Belum diisi' : SESSION_STATUS_LABELS[e.status]}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
