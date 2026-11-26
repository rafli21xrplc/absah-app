'use client';

import { PklPlacement, PklPlacementList } from '@absah/contracts';
import { Button, Input, Select } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { normalizePhone } from '@/lib/auth';
import { IfCap } from '@/lib/capabilities';
import { dateRangeLabel } from '@/lib/leave';
import { PKL_MANAGERS, PKL_OVERSEERS } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

/**
 * PKL (PKL-01): running placements. Managers see every one and add, change or cancel them; a guru
 * pembimbing sees their own students (the API filters).
 */
export default function PklPage() {
  const { schoolId, hasRole } = useWorkspace();
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [items, setItems] = useState<PklPlacement[] | null>(null);
  const [editing, setEditing] = useState<PklPlacement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelKeys = useRef(new Map<string, string>());

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/pkl/placements?scope=${scope}`, PklPlacementList, { schoolId })
      .then((r) => setItems(r.items))
      .catch(() => setError('Daftar PKL belum termuat. Muat ulang halaman.'));
  }, [schoolId, scope]);
  useEffect(load, [load]);

  async function cancel(p: PklPlacement) {
    if (!window.confirm(`Batalkan PKL ${p.student.name} di ${p.partner.name}? Presensi PKL berikutnya tidak dibuat lagi.`)) return;
    const key = cancelKeys.current.get(p.id) ?? newIdempotencyKey();
    cancelKeys.current.set(p.id, key);
    try {
      await api(`/pkl/placements/${p.id}/cancel`, PklPlacement, { method: 'POST', schoolId, idempotencyKey: key });
      cancelKeys.current.delete(p.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.');
    }
  }

  const manager = hasRole(...PKL_MANAGERS);
  return (
    <IfCap name="pkl.enabled" fallback={<p className={styles.main}>PKL belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>PKL</h1>
        <nav className={styles.toolbar} aria-label="Menu PKL">
          <Link href="/pkl/tinjauan">Tinjauan kehadiran</Link>
          <Link href="/pkl/jurnal">Jurnal siswa</Link>
          <Link href="/pkl/penilaian">Penilaian DUDI</Link>
          {hasRole(...PKL_OVERSEERS) && (
            <IfCap name="pkl.tracer">
              <Link href="/pkl/tracer">Tracer study alumni</Link>
            </IfCap>
          )}
          {hasRole(...PKL_OVERSEERS) && <Link href="/pkl/dudi">Mitra DUDI</Link>}
          {manager && <Link href="/pkl/penempatan">Tempatkan siswa</Link>}
        </nav>
        <label className={forms.field}>
          <span className={forms.label}>Tampilkan</span>
          <Select value={scope} onChange={(e) => setScope(e.target.value === 'all' ? 'all' : 'current')}>
            <option value="current">PKL berjalan dan akan datang</option>
            <option value="all">Semua, termasuk selesai dan batal</option>
          </Select>
        </label>
        {error && <p role="alert">{error}</p>}
        {editing && schoolId && (
          <PlacementForm
            schoolId={schoolId}
            placement={editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
        {items && items.length === 0 && <p className={styles.empty}>Belum ada siswa PKL.</p>}
        {items && items.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>DUDI</th>
                  <th>Periode</th>
                  <th>Pembimbing</th>
                  {manager && <th />}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.student.name}
                      <br />
                      <span className={styles.muted}>{p.student.className}</span>
                    </td>
                    <td>{p.partner.name}</td>
                    <td>
                      {dateRangeLabel(p.startsOn, p.endsOn)}{' '}
                      {p.status === 'cancelled' ? <span className={styles.badgeBad}>batal</span> : p.current && <span className={styles.badgeOk}>berjalan</span>}
                    </td>
                    <td>
                      Guru: {p.schoolMentor?.name ?? '–'}
                      <br />
                      <span className={styles.muted}>Industri: {p.industryMentor ? `${p.industryMentor.name} (${p.industryMentor.phone ?? '–'})` : 'belum ada'}</span>
                    </td>
                    {manager && (
                      <td className={styles.rowActions}>
                        {p.status === 'active' && (
                          <>
                            <Button variant="secondary" onClick={() => setEditing(p)}>
                              Ubah
                            </Button>
                            <Button variant="secondary" onClick={() => void cancel(p)}>
                              Batalkan
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </IfCap>
  );
}

/** End date and pembimbing industri of one placement (PATCH; an empty name and number removes the supervisor). */
function PlacementForm({ schoolId, placement, onDone }: { schoolId: string; placement: PklPlacement; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const key = useRef<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const name = String(d.get('mentorName') ?? '').trim();
    const phone = String(d.get('mentorPhone') ?? '').trim();
    const body: Record<string, unknown> = { endsOn: String(d.get('endsOn')) };
    // An empty number keeps the stored supervisor; the tick removes them.
    if (d.get('removeMentor') === 'on') body.industryMentor = null;
    else if (phone) body.industryMentor = { name, phoneNumber: normalizePhone(phone) };
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setErr(null);
    try {
      await api(`/pkl/placements/${placement.id}`, PklPlacement, { method: 'PATCH', schoolId, idempotencyKey: key.current, body });
      onDone();
    } catch (error) {
      setErr(error);
    } finally {
      setBusy(false);
    }
  }

  const message = err instanceof ApiError ? (fieldError(err, 'industryMentor.phoneNumber') ?? err.message) : err ? 'Belum tersimpan. Periksa sinyal, lalu coba lagi.' : null;
  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} onChange={() => (key.current = null)} aria-labelledby="ubah-pkl">
      <h2 id="ubah-pkl">
        {placement.student.name} di {placement.partner.name}
      </h2>
      <label className={forms.field}>
        <span className={forms.label}>Tanggal selesai</span>
        <Input name="endsOn" type="date" defaultValue={placement.endsOn} min={placement.startsOn} required />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Nama pembimbing industri</span>
        <Input name="mentorName" defaultValue={placement.industryMentor?.name ?? ''} maxLength={100} />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Nomor WhatsApp pembimbing industri</span>
        <Input name="mentorPhone" type="tel" inputMode="tel" placeholder={placement.industryMentor?.phone ?? '0812…'} />
        <span className={forms.hint}>Kosongkan untuk tetap memakai nomor yang tersimpan.</span>
      </label>
      {placement.industryMentor && (
        <label>
          <input type="checkbox" name="removeMentor" /> Hapus pembimbing industri
        </label>
      )}
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}
      <div className={styles.rowActions}>
        <Button type="submit" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Batal
        </Button>
      </div>
    </form>
  );
}
