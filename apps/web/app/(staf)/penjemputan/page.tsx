'use client';

import { PickupEvent, PickupEventList, PickupGuardian, PickupGuardianList, PickupPhotoLink } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { timeIn } from '@/lib/gate';
import { EVENT_STATUS_LABELS, RELATION_LABELS } from '@/lib/pickup';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

/** Held requests should reach the wali kelas quickly; the page refreshes itself this often. */
const REFRESH_MS = 20_000;

/**
 * Penjemputan (GRB-09, GRB-10): penjemput waiting for approval, unlisted penjemput the kiosk holds,
 * and the day's check-outs. The API decides who sees what (wali kelas: own rombel).
 */
export default function PenjemputanPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [queue, setQueue] = useState<PickupGuardian[] | null>(null);
  const [day, setDay] = useState<PickupEventList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!schoolId) return;
    Promise.all([api('/pickup-guardians?status=pending', PickupGuardianList, { schoolId }), api('/pickups', PickupEventList, { schoolId })])
      .then(([q, d]) => {
        setQueue(q.items);
        setDay(d);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat penjemputan.'));
  }, [schoolId]);
  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function act(id: string, path: string, schema: typeof PickupGuardian | typeof PickupEvent) {
    setBusy(id);
    setError(null);
    try {
      await api(path, schema, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  async function photo(id: string, path: string) {
    try {
      const link = await api(path, PickupPhotoLink, { schoolId });
      setPhotos((p) => ({ ...p, [id]: link.url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Foto tidak bisa dibuka.');
    }
  }

  const held = day?.items.filter((e) => e.status === 'held') ?? [];
  const rest = day?.items.filter((e) => e.status !== 'held') ?? [];
  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Penjemputan</h1>
      <IfCap name="gate.pickup" fallback={<p>Penjemputan resmi belum diaktifkan.</p>}>
        {error && <p role="alert">{error}</p>}
        {!day && !error && <p role="status">Memuat…</p>}

        <section className={styles.section} aria-labelledby="ditahan">
          <h2 id="ditahan">Penjemput tidak terdaftar menunggu</h2>
          {day && held.length === 0 && <p className={styles.muted}>Tidak ada yang menunggu.</p>}
          {held.map((e) => (
            <div key={e.id} className={styles.notice}>
              <p>
                <strong>{e.pickupName}</strong> ingin menjemput <strong>{e.studentName}</strong> ({e.className ?? '-'}) · {timeIn(timezone, e.requestedAt)}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- 5-minute presigned link, not optimizable */}
              {photos[e.id] && <img src={photos[e.id]} alt={`Foto ${e.pickupName}`} width={240} />}
              <div className={styles.rowActions}>
                {e.hasPhoto && !photos[e.id] && (
                  <Button variant="secondary" onClick={() => void photo(e.id, `/pickups/${e.id}/photo`)}>
                    Lihat foto
                  </Button>
                )}
                <Button disabled={busy === e.id} onClick={() => void act(e.id, `/pickups/${e.id}/allow`, PickupEvent)}>
                  Izinkan pulang
                </Button>
                <Button variant="secondary" disabled={busy === e.id} onClick={() => void act(e.id, `/pickups/${e.id}/deny`, PickupEvent)}>
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="persetujuan">
          <h2 id="persetujuan">Penjemput baru dari orang tua</h2>
          {queue?.length === 0 && <p className={styles.muted}>Tidak ada yang menunggu persetujuan.</p>}
          {queue?.map((g) => (
            <div key={g.id} className={styles.notice}>
              <p>
                <strong>{g.name}</strong> ({RELATION_LABELS[g.relation]}, {g.phone}) untuk <strong>{g.studentName}</strong> ({g.className ?? '-'})
                {g.validUntil && <> · berlaku sampai {g.validUntil}</>}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- 5-minute presigned link, not optimizable */}
              {photos[g.id] && <img src={photos[g.id]} alt={`Foto ${g.name}`} width={240} />}
              <div className={styles.rowActions}>
                {g.hasPhoto && !photos[g.id] && (
                  <Button variant="secondary" onClick={() => void photo(g.id, `/pickup-guardians/${g.id}/photo`)}>
                    Lihat foto
                  </Button>
                )}
                <Button disabled={busy === g.id} onClick={() => void act(g.id, `/pickup-guardians/${g.id}/approve`, PickupGuardian)}>
                  Setujui
                </Button>
                <Button variant="secondary" disabled={busy === g.id} onClick={() => void act(g.id, `/pickup-guardians/${g.id}/reject`, PickupGuardian)}>
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="hari-ini">
          <h2 id="hari-ini">Check-out hari ini</h2>
          {day && rest.length === 0 && <p className={styles.muted}>Belum ada siswa yang dijemput.</p>}
          {rest.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Siswa</th>
                    <th>Penjemput</th>
                    <th>Status</th>
                    <th>Jam</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.studentName} <span className={styles.muted}>{e.className}</span>
                      </td>
                      <td>
                        {e.pickupName}
                        {!e.listed && <span className={styles.muted}> (tidak terdaftar)</span>}
                      </td>
                      <td>{EVENT_STATUS_LABELS[e.status]}</td>
                      <td>{timeIn(timezone, e.checkedOutAt ?? e.requestedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </IfCap>
    </main>
  );
}
