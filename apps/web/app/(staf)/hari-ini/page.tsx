'use client';

import { SessionDetail, TodayResponse } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ALL_SESSIONS_VIEWERS, SESSION_STATUS_LABELS } from '@/lib/attendance';
import { isTransient, offlineStore, savedLabel, sessionCacheKey, todayCacheKey } from '@/lib/offline-queue';
import { SESSIONS_SYNCED_EVENT } from '@/lib/sync-sessions';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

/** Hari ini: the sessions to fill today, first the user's own (PRS-01). */
export default function HariIniPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const timezone = me.schools.find((x) => x.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const canSeeAll = hasRole(...ALL_SESSIONS_VIEWERS);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set while the list comes from the phone's copy (no signal). */
  const [copyFrom, setCopyFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const store = offlineStore();
    const load = () =>
      api(`/attendance/today?scope=${scope}`, TodayResponse, { schoolId })
        .then((d) => {
          setData(d);
          setCopyFrom(null);
          setError(null);
          void store.keep(todayCacheKey(schoolId, scope), d);
          // Keep the sessions the user can still fill on the phone, so they open and can be filled without signal (PRS-08).
          for (const s of d.sessions.filter((x) => x.status === 'open' && x.canFill).slice(0, 12)) {
            // Warm the page shell too (the service worker keeps it), so the screen opens without signal.
            void fetch(`/sesi/${s.id}`, { headers: { 'x-absah-warm': '1' } }).catch(() => undefined);
            void api(`/sessions/${s.id}`, SessionDetail, { schoolId })
              .then((detail) => store.keep(sessionCacheKey(schoolId, s.id), detail))
              .catch(() => undefined);
          }
        })
        .catch(async (err: unknown) => {
          const copy = isTransient(err) ? await store.cached(todayCacheKey(schoolId, scope)) : null;
          const parsed = TodayResponse.safeParse(copy?.value);
          if (copy && parsed.success) {
            setData(parsed.data);
            setCopyFrom(savedLabel(copy.savedAt, timezone));
          } else setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat sesi hari ini.');
        });
    void load();
    window.addEventListener(SESSIONS_SYNCED_EVENT, load);
    return () => window.removeEventListener(SESSIONS_SYNCED_EVENT, load);
  }, [schoolId, scope, timezone]);

  const open = data?.sessions.filter((s) => s.status === 'open' && s.canFill).length ?? 0;

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Hari ini</h1>
      {data && (
        <p className={styles.muted}>
          {dateLabel(data.schoolDate)}
          {open > 0 ? ` · ${open} sesi belum diisi` : ''}
        </p>
      )}
      {canSeeAll && (
        <div className={ui.segment} role="group" aria-label="Tampilkan">
          <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
            Sesi saya
          </button>
          <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            Semua sesi
          </button>
        </div>
      )}
      {copyFrom && <p className={styles.notice}>Tanpa sinyal: daftar dari salinan di HP (pukul {copyFrom}). Sesi yang diisi dikirim otomatis saat sinyal kembali.</p>}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      {data && data.sessions.length === 0 && (
        <p className={styles.notice}>
          {scope === 'mine' ? 'Tidak ada sesi untuk Anda hari ini.' : 'Belum ada sesi hari ini. Sesi dibuat otomatis pukul 05.00 pada hari sekolah.'}
        </p>
      )}
      <ul className={ui.sessions}>
        {data?.sessions.map((s) => (
          <li key={s.id}>
            <Link className={ui.sessionCard} href={`/sesi/${s.id}`}>
              <span className={ui.sessionTime}>{s.period ? `${s.period.startsAt}–${s.period.endsAt}` : s.mode === 'activity' ? 'Kegiatan' : 'Harian'}</span>
              <span className={ui.sessionTitle}>
                {s.owner.name}
                {s.subject ? ` · ${s.subject.name}` : ''}
              </span>
              <span className={styles.muted}>
                {s.teacher?.name ?? 'Belum ada guru'} · {s.counts.students} siswa
                {s.counts.absent > 0 ? ` · ${s.counts.absent} tidak hadir` : ''}
              </span>
              <span className={s.status === 'open' ? styles.badgeWarn : s.status === 'missed' ? styles.badgeBad : styles.badgeOk}>
                {SESSION_STATUS_LABELS[s.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
