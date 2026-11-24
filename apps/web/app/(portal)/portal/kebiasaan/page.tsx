'use client';

import { HabitDay, HabitJournal, PortalAttendance, type HabitCode } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { HABIT_LABELS, HABITS, habitsBody, shortDay, tickedOf } from '@/lib/habits';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../portal.module.css';

/**
 * Jurnal 7 KAIH (KEG-02): the parent (SD) or the student (SMP and up) ticks the habits of today and
 * the two days before; older days are shown read-only.
 */
export default function PortalKebiasaan() {
  const { schoolId } = useWorkspace();
  const mode = useCapability('habits.kaih');
  const [children, setChildren] = useState<PortalAttendance['items'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !mode || mode === 'off') return;
    api('/portal/attendance', PortalAttendance, { schoolId })
      .then((d) => setChildren(d.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat data.'));
  }, [schoolId, mode]);

  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>7 Kebiasaan Anak Indonesia Hebat</h1>
      {mode === 'off' && <p>Sekolah belum memakai jurnal 7 kebiasaan.</p>}
      {error && <p role="alert">{error}</p>}
      {mode && mode !== 'off' && !children && !error && <p role="status">Memuat…</p>}
      {schoolId && children?.map((c) => <Journal key={c.studentId} schoolId={schoolId} studentId={c.studentId} />)}
    </main>
  );
}

function Journal({ schoolId, studentId }: { schoolId: string; studentId: string }) {
  const [journal, setJournal] = useState<HabitJournal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/habits/${studentId}`, HabitJournal, { schoolId })
      .then(setJournal)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat jurnal.'));
  }, [schoolId, studentId]);
  useEffect(load, [load]);

  if (error) return <p role="alert">{error}</p>;
  if (!journal) return null;
  const first = journal.name.split(/\s+/)[0] ?? journal.name;
  return (
    <section className={styles.card} aria-label={`Jurnal ${first}`}>
      <h2>{first}</h2>
      {!journal.canEdit && <p className={styles.muted}>{journal.mode === 'parent' ? 'Diisi oleh orang tua.' : 'Diisi oleh siswa sendiri.'}</p>}
      {journal.days.map((d) =>
        journal.canEdit && d.date >= journal.editableFrom && !d.locked ? (
          <EditableDay key={d.date} schoolId={schoolId} studentId={studentId} day={d} onSaved={load} />
        ) : (
          <p key={d.date}>
            <strong>{shortDay(d.date)}</strong>: {d.filledBy ? `${tickedOf(d).size} dari 7` : <span className={styles.muted}>belum diisi</span>}
          </p>
        ),
      )}
    </section>
  );
}

function EditableDay({ schoolId, studentId, day, onSaved }: { schoolId: string; studentId: string; day: HabitDay; onSaved: () => void }) {
  const [ticked, setTicked] = useState<Set<HabitCode>>(() => tickedOf(day));
  const [key, setKey] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(h: HabitCode, on: boolean) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(h);
      else next.delete(h);
      return next;
    });
    setKey(newIdempotencyKey()); // other ticks = another save
    setMessage(null);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/habits/${studentId}/${day.date}`, HabitDay, { method: 'PUT', schoolId, idempotencyKey: key, body: { habits: habitsBody(ticked) } });
      setMessage('Tersimpan.');
      onSaved();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset aria-label={`Kebiasaan ${shortDay(day.date)}`}>
      <legend>{shortDay(day.date)}</legend>
      {HABITS.map((h) => (
        <label key={h} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" checked={ticked.has(h)} onChange={(e) => toggle(h, e.target.checked)} />
          {HABIT_LABELS[h]}
        </label>
      ))}
      <Button onClick={() => void save()} disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan'}
      </Button>
      {message && <p role="status">{message}</p>}
    </fieldset>
  );
}
