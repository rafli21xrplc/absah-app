'use client';

import { CardDeviceKeys, LeaveRequestList, MyCards, PortalAttendance } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/attendance';
import { signOut } from '@/lib/auth';
import { IfCap, useCapability } from '@/lib/capabilities';
import { loadKeys, storeKeys } from '@/lib/card';
import { timeIn } from '@/lib/gate';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS } from '@/lib/leave';
import { HISTORY_RANGES, type HistoryRange } from '@/lib/portal-children';
import { useWorkspace } from '@/lib/workspace';
import { CardQr } from '../card-qr';
import { useChildren } from './children';
import styles from '../portal.module.css';
import { StatusBadge } from '../status-badge';

const dayLabel = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00Z`));

/** PWA siswa (ORT-02): today, the dynamic card, and the last 30 days. Also serves parents' children. */
export default function PortalHome() {
  const router = useRouter();
  const { me, schoolId, hasRole, selectSchool } = useWorkspace();
  const kaih = useCapability('habits.kaih');
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const allowed = hasRole('siswa', 'orang_tua');
  const { selected, status: childrenStatus, children: kids } = useChildren();
  const parent = hasRole('orang_tua');
  const [days, setDays] = useState<HistoryRange>(30);
  const [data, setData] = useState<PortalAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A parent sees one child at a time (picked at the top, any school); a siswa sees themselves.
  const ready = parent ? selected !== null && selected.schoolId === schoolId : true;
  useEffect(() => {
    if (!schoolId || !allowed || !ready) return;
    const query = new URLSearchParams({ days: String(days) });
    if (parent && selected) query.set('studentId', selected.studentId);
    api(`/portal/attendance?${query.toString()}`, PortalAttendance, { schoolId })
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kehadiran. Periksa internet.'));
  }, [schoolId, allowed, ready, parent, selected, days]);

  async function leave() {
    await signOut();
    router.replace('/masuk/hp');
  }

  if (!schoolId && (childrenStatus === 'loading' || kids.length > 0)) return <p role="status">Memuat…</p>;
  if (!schoolId) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Pilih sekolah</h1>
        <div className={styles.actions}>
          {me.schools.map((s) => (
            <Button key={s.id} variant="secondary" onClick={() => selectSchool(s.id)}>
              {s.name}
            </Button>
          ))}
        </div>
      </main>
    );
  }
  if (!allowed) {
    return (
      <main className={styles.main}>
        <p>Halaman ini untuk siswa dan orang tua.</p>
        {hasRole('pembimbing_industri') ? <Link href="/dudi">Ke halaman pembimbing industri</Link> : <Link href="/">Ke beranda staf</Link>}
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>{me.schools.find((s) => s.id === schoolId)?.name}</p>
      <h1 className={styles.title}>Halo, {me.user.name.split(/\s+/)[0]}</h1>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      <IfCap name="gate.enabled">
        <Cards schoolId={schoolId} only={parent ? selected?.studentId : undefined} />
      </IfCap>
      {kaih && kaih !== 'off' && (
        <p>
          <Link href="/portal/kebiasaan">7 Kebiasaan Anak Indonesia Hebat: isi jurnal hari ini</Link>
        </p>
      )}
      {hasRole('siswa') && (
        <IfCap name="pkl.enabled">
          <p>
            <Link href="/portal/pkl">PKL: check-in di DUDI dan jurnal harian</Link>
          </p>
        </IfCap>
      )}
      <IfCap name="religious.memorization">
        <p>
          <Link href="/portal/hafalan">Hafalan Al-Qur&apos;an: riwayat setoran</Link>
        </p>
      </IfCap>
      {hasRole('orang_tua') && (
        <p>
          <Link href="/portal/preferensi">Pesan WhatsApp: pilih yang ingin diterima</Link>
        </p>
      )}
      {hasRole('orang_tua') && (
        <IfCap name="gate.pickup">
          <p>
            <Link href="/portal/penjemput">Penjemput anak: siapa saja yang boleh menjemput</Link>
          </p>
        </IfCap>
      )}
      {hasRole('orang_tua') && (
        <IfCap name="portal.liaison">
          <p>
            <Link href="/portal/penghubung">Buku penghubung: pesan dengan wali kelas dan guru</Link>
          </p>
        </IfCap>
      )}
      <div className={styles.range} role="group" aria-label="Rentang riwayat">
        {HISTORY_RANGES.map((r) => (
          <Button key={r} variant={r === days ? 'primary' : 'secondary'} aria-pressed={r === days} onClick={() => setDays(r)}>
            {r} hari
          </Button>
        ))}
      </div>
      {data?.items.map((s) => (
        <section key={s.studentId} className={styles.card} aria-label={`Kehadiran ${s.name}`}>
          <h2>
            {s.name} · {s.className}
          </h2>
          <p>
            Hari ini: <StatusBadge status={s.today.status} />
            {s.today.arrivedAt && <span className={styles.muted}> · tiba {timeIn(timezone, s.today.arrivedAt)}</span>}
          </p>
          <p className={styles.counts} aria-label={`${days} hari terakhir`}>
            {(['H', 'T', 'S', 'I', 'A'] as const).map((k) => (
              <span key={k}>
                <strong>{s.counts[k] ?? 0}</strong> {STATUS_LABELS[k].toLowerCase()}
              </span>
            ))}
          </p>
          {s.days.length === 0 ? (
            <p className={styles.muted}>Belum ada rekap {days} hari terakhir.</p>
          ) : (
            <ul className={styles.list} aria-label="Riwayat">
              {s.days.map((d) => (
                <li key={d.date}>
                  <span>{dayLabel(d.date)}</span>
                  <span>{STATUS_LABELS[d.status]}</span>
                </li>
              ))}
            </ul>
          )}
          {parent && <ChildLeave schoolId={schoolId} enrollmentId={s.enrollmentId} />}
        </section>
      ))}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void leave()}>
          Keluar
        </Button>
      </div>
    </main>
  );
}

/** Cards this account holds; each is bound to this phone once and then works offline for a week. */
function Cards({ schoolId, only }: { schoolId: string; only?: string }) {
  const [cards, setCards] = useState<MyCards['items']>([]);
  useEffect(() => {
    api('/cards/mine', MyCards, { schoolId })
      .then((c) => setCards(c.items))
      .catch(() => setCards([]));
  }, [schoolId]);
  return (
    <>
      {cards
        .filter((c) => !only || c.studentId === only)
        .map((c) => (
          <StudentCard key={c.studentId} schoolId={schoolId} studentId={c.studentId} name={c.name.split(/\s+/)[0] ?? c.name} />
        ))}
    </>
  );
}

function StudentCard({ schoolId, studentId, name }: { schoolId: string; studentId: string; name: string }) {
  const storageKey = `absah.card.${studentId}`;
  const [keys, setKeys] = useState<CardDeviceKeys | null>(() => loadKeys(storageKey));
  const [lost, setLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh day keys while online; a 404 means another phone took the card over.
  useEffect(() => {
    const stored = loadKeys(storageKey);
    if (!stored) return;
    api(`/cards/devices/${stored.deviceId}/keys`, CardDeviceKeys, { schoolId })
      .then((k) => {
        storeKeys(storageKey, k);
        setKeys(k);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          storeKeys(storageKey, null);
          setKeys(null);
          setLost(true);
        }
      });
  }, [schoolId, storageKey]);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const k = await api('/cards/devices', CardDeviceKeys, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { studentId, label: 'Aplikasi Absah' } });
      storeKeys(storageKey, k);
      setKeys(k);
      setLost(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby={`kartu-${studentId}`}>
      <h2 id={`kartu-${studentId}`}>Kartu {name}</h2>
      {keys ? (
        <CardQr keys={keys} name={name} />
      ) : (
        <>
          <p className={styles.muted}>{lost ? 'Kartu sekarang aktif di HP lain.' : 'Kartu belum aktif di HP ini.'} Mengaktifkan di sini menghentikan kartu di HP sebelumnya.</p>
          <div className={styles.actions}>
            <Button disabled={busy} onClick={() => void activate()}>
              Aktifkan kartu di HP ini
            </Button>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

/** The child's izin, newest first (parents can already read their children's requests, ORT-05). */
function ChildLeave({ schoolId, enrollmentId }: { schoolId: string; enrollmentId: string }) {
  const [items, setItems] = useState<LeaveRequestList['items'] | null>(null);
  useEffect(() => {
    api('/leave-requests?status=all', LeaveRequestList, { schoolId })
      .then((res) => setItems(res.items.filter((l) => l.student.enrollmentId === enrollmentId).slice(0, 10)))
      .catch(() => setItems([]));
  }, [schoolId, enrollmentId]);
  if (!items || items.length === 0) return null;
  return (
    <>
      <h3>Izin</h3>
      <ul className={styles.list} aria-label="Riwayat izin">
        {items.map((l) => (
          <li key={l.id}>
            <span>
              {LEAVE_KIND_LABELS[l.kind]} · {dateRangeLabel(l.startsOn, l.endsOn)}
            </span>
            <span>{LEAVE_STATUS_LABELS[l.status]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
