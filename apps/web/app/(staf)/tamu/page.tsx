'use client';

import { Visitor, VisitorList, VisitorPhotoLink } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { timeIn } from '@/lib/gate';
import { todayIn } from '@/lib/leave';
import { VISITOR_MANAGERS } from '@/lib/visitors';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

/** Buku tamu (GRB-11): guests who signed in at the kiosk; piket signs them out. */
export default function TamuPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const manager = hasRole(...VISITOR_MANAGERS);
  const [date, setDate] = useState(() => todayIn(timezone));
  const [insideOnly, setInsideOnly] = useState(false);
  const [list, setList] = useState<VisitorList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // One key per guest: a retry after a lost answer is the same sign-out.
  const [keys] = useState(() => new Map<string, string>());

  const load = useCallback(() => {
    if (!schoolId || !date) return;
    api(`/visitors?date=${date}&status=${insideOnly ? 'inside' : 'all'}`, VisitorList, { schoolId })
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat buku tamu.'));
  }, [schoolId, date, insideOnly]);
  useEffect(load, [load]);

  async function signOut(v: Visitor) {
    const key = keys.get(v.id) ?? newIdempotencyKey();
    keys.set(v.id, key);
    setBusy(v.id);
    try {
      await api(`/visitors/${v.id}/leave`, Visitor, { method: 'PATCH', schoolId, idempotencyKey: key });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  async function showPhoto(v: Visitor) {
    // Open the tab first (a popup after an await is blocked), then point it at the 5-minute link.
    const tab = window.open('', '_blank');
    try {
      const link = await api(`/visitors/${v.id}/photo`, VisitorPhotoLink, { schoolId });
      if (tab) tab.location.href = link.url;
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiError ? err.message : 'Foto tidak bisa dibuka.');
    }
  }

  return (
    <IfCap name="gate.visitors" fallback={<p className={styles.main}>Buku tamu belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Buku tamu</h1>
        <div className={styles.toolbar}>
          <label className={forms.field}>
            Tanggal
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={insideOnly} onChange={(e) => setInsideOnly(e.target.checked)} /> Hanya yang masih di sekolah
          </label>
        </div>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        {list && (
          <p className={styles.muted} role="status">
            {list.inside} tamu masih di sekolah.
          </p>
        )}
        {list && list.items.length === 0 && <p className={styles.empty}>Belum ada tamu.</p>}
        <ul className={ui.sessions}>
          {list?.items.map((v) => (
            <li key={v.id} className={ui.student} aria-label={`Tamu ${v.name}`}>
              <span className={ui.studentName}>
                {v.name}
                {v.organization ? ` · ${v.organization}` : ''}
              </span>
              <span>
                {v.purpose}
                {v.host ? ` · menemui ${v.host.name}` : ''}
              </span>
              <span className={styles.muted}>
                Datang {timeIn(timezone, v.arrivedAt)}
                {v.leftAt ? ` · keluar ${timeIn(timezone, v.leftAt)}` : ''}
              </span>
              <div className={styles.rowActions}>
                {v.hasPhoto && (
                  <Button variant="secondary" onClick={() => void showPhoto(v)}>
                    Lihat foto
                  </Button>
                )}
                {!v.leftAt && manager && (
                  <Button disabled={busy !== null} onClick={() => void signOut(v)}>
                    {busy === v.id ? 'Menyimpan…' : 'Tandai keluar'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </IfCap>
  );
}
