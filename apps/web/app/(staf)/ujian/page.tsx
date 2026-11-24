'use client';

import { ExamPeriod, ExamPeriodList, MyRooms } from '@absah/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { EMPTY_PERIOD_FORM, EXAM_MANAGING, EXAM_VIEWING, examWindowLabel, periodBody, ruleSummary, type PeriodForm } from '@/lib/exam';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { PeriodFormFields } from './period-form';

/** Ujian (UJN): the exams of the school with their rule; every pengawas also sees their own rooms here. */
export default function UjianPage() {
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="exam.enabled" fallback={<p className={styles.main}>Ujian belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Ujian</h1>
        <MyRoomsSection />
        {hasRole(...EXAM_VIEWING) && <Periods manage={hasRole(...EXAM_MANAGING)} />}
      </main>
    </IfCap>
  );
}

function MyRoomsSection() {
  const { schoolId } = useWorkspace();
  const [rooms, setRooms] = useState<MyRooms['items']>([]);
  useEffect(() => {
    if (!schoolId) return;
    api('/exam/my-rooms', MyRooms, { schoolId }).then((r) => setRooms(r.items)).catch(() => undefined);
  }, [schoolId]);
  if (rooms.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="ruang-saya">
      <h2 id="ruang-saya">Ruang yang saya awasi</h2>
      <ul>
        {rooms.map((r) => (
          <li key={r.room.id}>
            <Link href={`/ujian/ruang/${r.room.id}`}>
              {r.room.name} · {r.period.name} ({examWindowLabel(r.period.startsOn, r.period.endsOn)})
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Periods({ manage }: { manage: boolean }) {
  const { schoolId } = useWorkspace();
  const [items, setItems] = useState<ExamPeriod[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/exam/periods?includeClosed=${closed}`, ExamPeriodList, { schoolId })
      .then((r) => setItems(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat ujian.'));
  }, [schoolId, closed]);
  useEffect(load, [load]);

  async function create(form: PeriodForm) {
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setFormError(null);
    try {
      await api('/exam/periods', ExamPeriod, { method: 'POST', schoolId, idempotencyKey: key.current, body: periodBody(form) });
      key.current = null;
      setFormKey((n) => n + 1); // a fresh, empty form
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={styles.section} aria-labelledby="daftar">
        <h2 id="daftar">Daftar ujian</h2>
        <label>
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Tampilkan yang sudah ditutup
        </label>
        {error && <p role="alert">{error}</p>}
        {!items && !error && <p role="status">Memuat…</p>}
        {items && items.length === 0 && <p className={styles.empty}>Belum ada ujian.</p>}
        <ul>
          {items?.map((p) => (
            <li key={p.id}>
              <Link href={`/ujian/${p.id}`}>{p.name}</Link> · {examWindowLabel(p.startsOn, p.endsOn)}
              {p.closed && <span className={styles.badge}> Ditutup</span>}
              <br />
              <span className={styles.muted}>{ruleSummary(p)}</span>
            </li>
          ))}
        </ul>
      </section>
      {manage && (
        <section className={styles.section} aria-labelledby="baru">
          <h2 id="baru">Ujian baru</h2>
          <PeriodFormFields key={formKey} initial={EMPTY_PERIOD_FORM} submitLabel="Buat ujian" busy={busy} error={formError} onSubmit={(f) => void create(f)} onEdit={() => (key.current = null)} />
        </section>
      )}
    </>
  );
}
