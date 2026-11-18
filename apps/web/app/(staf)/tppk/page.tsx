'use client';

import { TppkCaseList, TppkReportList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/tppk';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

const when = (iso: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));

/** Papan TPPK (KSW-07): new reports first, then the cases. Members only; every load is audited. */
export default function TppkPage() {
  const { schoolId } = useWorkspace();
  const [reports, setReports] = useState<TppkReportList | null>(null);
  const [cases, setCases] = useState<TppkCaseList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([api('/tppk/reports?status=diterima', TppkReportList, { schoolId }), api('/tppk/cases', TppkCaseList, { schoolId })])
      .then(([r, c]) => {
        setReports(r);
        setCases(c);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat papan TPPK.'));
  }, [schoolId]);

  const open = cases?.items.filter((c) => c.status === 'open') ?? [];
  const closed = cases?.items.filter((c) => c.status === 'closed') ?? [];

  return (
    <IfCap name="student.tppk" fallback={<p className={styles.main}>Kanal TPPK belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>TPPK</h1>
        <p className={styles.muted}>Hanya anggota TPPK yang melihat halaman ini. Setiap pembukaan laporan dan kasus tercatat.</p>
        {error && <p role="alert">{error}</p>}

        <section className={styles.section} aria-labelledby="baru">
          <h2 id="baru">Laporan baru</h2>
          {reports?.items.length === 0 && <p className={styles.muted}>Tidak ada laporan baru.</p>}
          <ul className={ui.sessions}>
            {reports?.items.map((r) => (
              <li key={r.id} className={ui.student}>
                <Link href={`/tppk/laporan/${r.id}`} className={ui.studentName}>
                  {CATEGORY_LABELS[r.category].label}
                </Link>
                <span>
                  Masuk {when(r.receivedAt)} · {r.isAnonymous ? 'anonim' : 'dengan nama'}
                </span>
                <span className={styles.badgeWarn}>{STATUS_LABELS[r.status].label}</span>
              </li>
            ))}
          </ul>
        </section>

        {[
          { id: 'terbuka', title: 'Kasus ditangani', items: open, empty: 'Tidak ada kasus terbuka.' },
          { id: 'selesai', title: 'Kasus selesai', items: closed, empty: 'Belum ada kasus selesai.' },
        ].map((group) => (
          <section key={group.id} className={styles.section} aria-labelledby={group.id}>
            <h2 id={group.id}>{group.title}</h2>
            {cases && group.items.length === 0 && <p className={styles.muted}>{group.empty}</p>}
            <ul className={ui.sessions}>
              {group.items.map((c) => (
                <li key={c.id} className={ui.student}>
                  <Link href={`/tppk/kasus/${c.id}`} className={ui.studentName}>
                    {c.summary}
                  </Link>
                  <span>
                    {c.category ? `${CATEGORY_LABELS[c.category].label} · ` : ''}dibuka {when(c.openedAt)}
                    {c.openedBy ? ` oleh ${c.openedBy.name}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </IfCap>
  );
}
