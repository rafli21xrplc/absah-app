'use client';

import { DudiPartner, DudiPartnerList, PKL_DEFAULT_RADIUS_M, type DudiWorkDay } from '@absah/contracts';
import { Button, Input } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { DAY_LABELS, DAYS } from '@/lib/activities';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { DEFAULT_WORK_HOURS, parseCoordinates, PKL_MANAGERS, workHoursLabel } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';

type Editing = { partner: DudiPartner | null };

/** DUDI partners (PKL-01): location, radius and working hours used to check PKL check-ins. */
export default function DudiPartnersPage() {
  const { schoolId, hasRole } = useWorkspace();
  const [partners, setPartners] = useState<DudiPartner[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/pkl/partners', DudiPartnerList, { schoolId })
      .then((r) => setPartners(r.items))
      .catch(() => setError('Daftar DUDI belum termuat. Muat ulang halaman.'));
  }, [schoolId]);
  useEffect(load, [load]);

  const manager = hasRole(...PKL_MANAGERS);
  return (
    <IfCap name="pkl.enabled" fallback={<p className={styles.main}>PKL belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/pkl">
          ← PKL
        </Link>
        <h1 className={styles.title}>Mitra DUDI</h1>
        {error && <p role="alert">{error}</p>}
        {manager && !editing && <Button onClick={() => setEditing({ partner: null })}>Tambah DUDI</Button>}
        {editing && schoolId && (
          <PartnerForm
            schoolId={schoolId}
            partner={editing.partner}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
        {partners && partners.length === 0 && <p className={styles.empty}>Belum ada DUDI.</p>}
        {partners && partners.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>DUDI</th>
                  <th>Jam kerja</th>
                  <th className={styles.num}>Radius</th>
                  <th className={styles.num}>Siswa PKL</th>
                  {manager && <th />}
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name} {!p.active && <span className={styles.badgeWarn}>nonaktif</span>}
                      <br />
                      <span className={styles.muted}>{p.address}</span>
                    </td>
                    <td>{workHoursLabel(p.workHours, DAY_LABELS)}</td>
                    <td className={styles.num}>{p.radiusM} m</td>
                    <td className={styles.num}>{p.activePlacements}</td>
                    {manager && (
                      <td>
                        <Button variant="secondary" onClick={() => setEditing({ partner: p })}>
                          Ubah
                        </Button>
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

function PartnerForm({ schoolId, partner, onDone }: { schoolId: string; partner: DudiPartner | null; onDone: () => void }) {
  const [hours, setHours] = useState<DudiWorkDay[]>(partner?.workHours ?? DEFAULT_WORK_HOURS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const key = useRef<string | null>(null);

  const setDay = (day: number, patch: Partial<DudiWorkDay> | null) =>
    setHours((hs) => {
      const rest = hs.filter((h) => h.day !== day);
      const current = hs.find((h) => h.day === day) ?? { day, startsAt: '08:00', endsAt: '16:00' };
      return patch === null ? rest : [...rest, { ...current, ...patch }].sort((a, b) => a.day - b.day);
    });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const point = parseCoordinates(String(d.get('point') ?? ''));
    if (!point) {
      setErr(new Error('Tempel titik lokasi dari Google Maps, misalnya -6.2383, 106.9756.'));
      return;
    }
    const body = {
      name: String(d.get('name') ?? '').trim(),
      address: String(d.get('address') ?? '').trim(),
      ...point,
      radiusM: Number(d.get('radiusM')),
      workHours: hours,
      ...(partner ? { active: d.get('active') === 'on' } : {}),
    };
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setErr(null);
    try {
      await api(partner ? `/pkl/partners/${partner.id}` : '/pkl/partners', DudiPartner, {
        method: partner ? 'PATCH' : 'POST',
        schoolId,
        idempotencyKey: key.current,
        body,
      });
      onDone();
    } catch (error) {
      setErr(error);
    } finally {
      setBusy(false);
    }
  }

  const message = err instanceof Error ? (err instanceof ApiError ? (fieldError(err, 'workHours') ?? err.message) : err.message) : null;
  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} onChange={() => (key.current = null)} aria-labelledby="dudi-form">
      <h2 id="dudi-form">{partner ? `Ubah ${partner.name}` : 'DUDI baru'}</h2>
      <label className={forms.field}>
        <span className={forms.label}>Nama DUDI</span>
        <Input name="name" defaultValue={partner?.name} required minLength={2} maxLength={150} />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Alamat</span>
        <Input name="address" defaultValue={partner?.address} required minLength={5} maxLength={300} />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Titik lokasi</span>
        <Input name="point" defaultValue={partner ? `${partner.latitude}, ${partner.longitude}` : ''} required placeholder="-6.2383, 106.9756" />
        <span className={forms.hint}>Di Google Maps, tekan lama titik gerbang DUDI, lalu salin angkanya ke sini.</span>
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Radius check-in (meter)</span>
        <Input name="radiusM" type="number" inputMode="numeric" min={25} max={2000} defaultValue={partner?.radiusM ?? PKL_DEFAULT_RADIUS_M} required />
      </label>
      <fieldset className={forms.field}>
        <legend className={forms.label}>Hari dan jam kerja</legend>
        {DAYS.map((day) => {
          const h = hours.find((x) => x.day === day);
          return (
            <div key={day} className={styles.toolbar}>
              <label>
                <input type="checkbox" checked={Boolean(h)} onChange={(e) => setDay(day, e.target.checked ? {} : null)} /> {DAY_LABELS[day]}
              </label>
              {h && (
                <>
                  <Input type="time" aria-label={`Mulai ${DAY_LABELS[day]}`} value={h.startsAt} onChange={(e) => setDay(day, { startsAt: e.target.value })} />
                  <Input type="time" aria-label={`Selesai ${DAY_LABELS[day]}`} value={h.endsAt} onChange={(e) => setDay(day, { endsAt: e.target.value })} />
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      {partner && (
        <label>
          <input type="checkbox" name="active" defaultChecked={partner.active} /> DUDI aktif
        </label>
      )}
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}
      <div className={styles.rowActions}>
        <Button type="submit" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan DUDI'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Batal
        </Button>
      </div>
    </form>
  );
}
