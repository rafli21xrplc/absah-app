'use client';

import { Activity, ActivityMemberList, ActivityRecap, SessionDetail } from '@absah/contracts';
import { Button, DateInput, EmptyState } from '@absah/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVITY_MANAGERS, KIND_LABELS, LOCATION_LABELS, monthRange, percent, scheduleLabel } from '@/lib/activities';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { monthIn } from '@/lib/journal';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

type Member = ActivityMemberList['items'][number];

/** One activity: open today's session, members (pembina or managers), monthly rekap. */
export default function KegiatanDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const manager = hasRole(...ACTIVITY_MANAGERS);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const coach = activity?.coaches.some((c) => c.id === me.user.id) ?? false;

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/activities/${id}`, Activity, { schoolId })
      .then(setActivity)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kegiatan.'));
  }, [schoolId, id]);
  useEffect(load, [load]);

  async function openSession() {
    setBusy(true);
    setError(null);
    try {
      const session = await api(`/activities/${id}/sessions`, SessionDetail, { method: 'POST', schoolId, body: {} });
      router.push(`/sesi/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terbuka. Periksa sinyal, lalu coba lagi.');
      setBusy(false);
    }
  }

  async function setActive(active: boolean) {
    if (!active && !window.confirm('Nonaktifkan kegiatan ini? Sesi presensinya tidak dibuat lagi.')) return;
    setBusy(true);
    try {
      setActivity(await api(`/activities/${id}`, Activity, { method: 'PATCH', schoolId, idempotencyKey: newIdempotencyKey(), body: { active } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/kegiatan">
        ← Kegiatan
      </Link>
      <h1 className={styles.title}>{activity?.name ?? 'Kegiatan'}</h1>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {activity && (
        <>
          <p>
            {KIND_LABELS[activity.kind]} · {LOCATION_LABELS[activity.location]} · {scheduleLabel(activity)}
            <br />
            Pembina: {activity.coaches.map((c) => c.name).join(', ')}
            {!activity.active && <span className={styles.badgeWarn}> Tidak aktif</span>}
          </p>
          <div className={styles.toolbar}>
            {activity.active && (coach || manager) && (
              <Button disabled={busy} onClick={() => void openSession()}>
                Presensi kegiatan hari ini
              </Button>
            )}
            {manager && (
              <Button variant="secondary" disabled={busy} onClick={() => void setActive(!activity.active)}>
                {activity.active ? 'Nonaktifkan' : 'Aktifkan lagi'}
              </Button>
            )}
          </div>
          <Members schoolId={schoolId} activityId={id} canEdit={coach || manager} onSaved={load} />
          <Recap schoolId={schoolId} activityId={id} timezone={timezone} />
        </>
      )}
    </main>
  );
}

function Members({ schoolId, activityId, canEdit, onSaved }: { schoolId: string | null; activityId: string; canEdit: boolean; onSaved: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Member[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api(`/activities/${activityId}/members`, ActivityMemberList, { schoolId })
      .then((r) => setMembers(r.items))
      .catch(() => setMembers([]));
  }, [schoolId, activityId]);

  useEffect(() => {
    if (!schoolId || !canEdit || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`/activities/students?q=${encodeURIComponent(query.trim())}`, ActivityMemberList, { schoolId, signal: controller.signal })
        .then((r) => setFound(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schoolId, canEdit, query]);

  const change = (next: Member[]) => {
    key.current = null;
    setMembers(next);
    setDirty(true);
    setMessage(null);
  };

  async function save() {
    if (!members) return;
    key.current ??= newIdempotencyKey();
    setBusy(true);
    try {
      const saved = await api(`/activities/${activityId}/members`, ActivityMemberList, {
        method: 'PUT',
        schoolId,
        idempotencyKey: key.current,
        body: { enrollmentIds: members.map((m) => m.enrollmentId) },
      });
      key.current = null;
      setMembers(saved.items);
      setDirty(false);
      setMessage('Peserta tersimpan.');
      onSaved();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu simpan lagi.');
    } finally {
      setBusy(false);
    }
  }

  const has = (m: Member) => members?.some((x) => x.enrollmentId === m.enrollmentId) ?? false;

  return (
    <section className={styles.section} aria-labelledby="peserta">
      <h2 id="peserta">Peserta ({members?.length ?? 0})</h2>
      {members && members.length === 0 && <EmptyState bare headingLevel="p" kind="empty" title="Belum ada peserta." />}
      <ul className={ui.sessions} aria-label="Peserta">
        {members?.map((m) => (
          <li key={m.enrollmentId} className={ui.student}>
            <span className={ui.studentName}>
              {m.name} · {m.className}
            </span>
            {canEdit && (
              <Button variant="secondary" onClick={() => change(members.filter((x) => x.enrollmentId !== m.enrollmentId))}>
                Keluarkan
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <label className={forms.field}>
            Tambah siswa
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik minimal 2 huruf nama" autoComplete="off" />
          </label>
          {query.trim().length >= 2 && (
            <ul className={ui.sessions} aria-label="Hasil pencarian">
              {found
                .filter((s) => !has(s))
                .map((s) => (
                  <li key={s.enrollmentId}>
                    <Button variant="secondary" onClick={() => change([...(members ?? []), s])}>
                      + {s.name} · {s.className}
                    </Button>
                  </li>
                ))}
            </ul>
          )}
          {message && <p role="status">{message}</p>}
          <Button disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? 'Menyimpan…' : 'Simpan peserta'}
          </Button>
        </>
      )}
    </section>
  );
}

function Recap({ schoolId, activityId, timezone }: { schoolId: string | null; activityId: string; timezone: string }) {
  const [month, setMonth] = useState(() => monthIn(timezone));
  const [recap, setRecap] = useState<ActivityRecap | null>(null);

  useEffect(() => {
    if (!schoolId || !month) return;
    const { from, to } = monthRange(month);
    api(`/activities/${activityId}/recap?from=${from}&to=${to}`, ActivityRecap, { schoolId })
      .then(setRecap)
      .catch(() => setRecap(null));
  }, [schoolId, activityId, month]);

  return (
    <section className={styles.section} aria-labelledby="rekap">
      <h2 id="rekap">Rekap kehadiran kegiatan</h2>
      <label className={forms.field}>
        Bulan
        <DateInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>
      {recap && (
        <>
          <p>{recap.sessions} pertemuan. Terpisah dari rekap kehadiran kelas.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>H</th>
                  <th>T</th>
                  <th>S</th>
                  <th>I</th>
                  <th>A</th>
                  <th>Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {recap.items.map((r) => (
                  <tr key={r.enrollmentId}>
                    <td>
                      {r.name} · {r.className}
                    </td>
                    <td>{r.counts.H}</td>
                    <td>{r.counts.T}</td>
                    <td>{r.counts.S}</td>
                    <td>{r.counts.I}</td>
                    <td>{r.counts.A}</td>
                    <td>{percent(r.presentRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
