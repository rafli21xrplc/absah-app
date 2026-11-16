'use client';

import { DAY_NAMES, ScheduleConflictDetail, ScheduleResponse, ScheduleSlot, Subject } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import page from './jadwal.module.css';
import type { ScheduleData } from './page';

const Conflicts = z.object({ conflicts: z.array(ScheduleConflictDetail) });
const NEW_SUBJECT = '__new__';

/** "Pak Andi sudah mengajar VII A" / "2 siswa (ADI, BUDI) sudah ada pelajaran di Informatika A". */
export function conflictText(c: ScheduleConflictDetail): string {
  if (c.kind === 'teacher') return `${c.teacher ?? 'Guru ini'} sudah mengajar ${c.with} di jam ini.`;
  if (c.kind === 'owner') return `${c.with} sudah punya pelajaran di jam ini.`;
  const names = c.students.join(', ') + (c.studentCount > c.students.length ? `, dan ${c.studentCount - c.students.length} lainnya` : '');
  return `${c.studentCount} siswa (${names}) sudah ada pelajaran di ${c.with} pada jam ini.`;
}

interface Cell {
  day: number;
  period: number;
}

/** Weekly grid of one rombel: days across, jam pelajaran down. Click a cell to set its lesson. */
export function ScheduleGrid({ data, canEdit, onChanged }: { data: ScheduleData; canEdit: boolean; onChanged: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [classId, setClassId] = useState(data.classes.items[0]?.id ?? '');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflictDetail[]>([]);
  const [busy, setBusy] = useState(false);
  const actionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId || !classId) return;
    api(`/schedule?classId=${classId}`, ScheduleResponse, { schoolId })
      .then((r) => setSlots(r.slots))
      .catch(() => setError('Tidak bisa memuat jadwal rombel.'));
  }, [schoolId, classId]);

  const days = data.periods.days.filter((d) => d.periods.length > 0);
  const numbers = useMemo(() => [...new Set(days.flatMap((d) => d.periods.map((p) => p.number)))].sort((a, b) => a - b), [days]);
  const at = (c: Cell) => slots.find((s) => s.day === c.day && s.period === c.period);
  const lesson = selected ? at(selected) : undefined;

  if (days.length === 0) {
    return <p className={styles.notice}>Atur jam pelajaran dulu di tab Jam pelajaran, lalu isi jadwal di sini.</p>;
  }

  function pick(cell: Cell) {
    actionKey.current = null;
    setSelected(cell);
    setError(null);
    setConflicts([]);
  }

  async function run(action: () => Promise<void>) {
    actionKey.current ??= newIdempotencyKey(); // retries of the same click reuse the key
    setBusy(true);
    setError(null);
    setConflicts([]);
    try {
      await action();
      actionKey.current = null;
    } catch (err) {
      const details = err instanceof ApiError && err.code === 'SCHEDULE_CONFLICT' ? Conflicts.safeParse(err.body.details) : null;
      if (details?.success) setConflicts(details.data.conflicts);
      else setError(err instanceof ApiError ? err.message : 'Tidak bisa menyimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const subjectChoice = String(form.get('subject') ?? '');
    const newName = String(form.get('newSubject') ?? '').trim();
    const teacherId = String(form.get('teacher') ?? '') || null;
    void run(async () => {
      const key = actionKey.current ?? newIdempotencyKey();
      let subjectId = subjectChoice;
      if (subjectChoice === NEW_SUBJECT) {
        subjectId = (await api('/subjects', Subject, { method: 'POST', body: { name: newName }, schoolId, idempotencyKey: `${key}-subject` })).id;
        await onChanged();
      }
      const body = { ownerType: 'class', ownerId: classId, day: selected.day, period: selected.period, subjectId, teacherId };
      const slot = await api('/schedule/slots', ScheduleSlot, { method: 'PUT', body, schoolId, idempotencyKey: key });
      setSlots((prev) => [...prev.filter((s) => !(s.day === slot.day && s.period === slot.period)), slot]);
      setSelected(null);
    });
  };

  const remove = () => {
    if (!lesson) return;
    void run(async () => {
      await api(`/schedule/slots/${lesson.id}`, z.null(), { method: 'DELETE', schoolId, idempotencyKey: actionKey.current ?? newIdempotencyKey() });
      setSlots((prev) => prev.filter((s) => s.id !== lesson.id));
      setSelected(null);
    });
  };

  return (
    <section>
      <label className={forms.field}>
        <span className={forms.label}>Rombel</span>
        <select className={forms.input} value={classId} onChange={(e) => {
            setClassId(e.target.value);
            setSelected(null);
          }}>
          {data.classes.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className={`${styles.tableWrap} ${page.spaced}`}>
        <table className={page.grid} aria-label="Jadwal mingguan">
          <thead>
            <tr>
              <th>Jam</th>
              {days.map((d) => (
                <th key={d.day}>{DAY_NAMES[d.day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numbers.map((n) => (
              <tr key={n}>
                <th>{n}</th>
                {days.map((d) => {
                  const period = d.periods.find((p) => p.number === n);
                  if (!period) return <td key={d.day} className={page.noPeriod} />;
                  const s = at({ day: d.day, period: n });
                  const isSelected = selected?.day === d.day && selected.period === n;
                  return (
                    <td key={d.day}>
                      <button
                        type="button"
                        className={s ? page.cell : page.cellEmpty}
                        disabled={!canEdit}
                        aria-pressed={isSelected}
                        aria-label={`${DAY_NAMES[d.day]} jam ${n}: ${s ? s.subject.name : 'kosong'}`}
                        onClick={() => pick({ day: d.day, period: n })}
                      >
                        <span className={page.time}>
                          {period.startsAt}–{period.endsAt}
                        </span>
                        {s ? s.subject.name : '—'}
                        {s?.teacher && <span className={page.teacher}>{s.teacher.name}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && canEdit && (
        <SlotEditor
          key={`${classId}-${selected.day}-${selected.period}`}
          title={`${DAY_NAMES[selected.day]}, jam ke-${selected.period}`}
          data={data}
          lesson={lesson}
          busy={busy}
          onSubmit={save}
          onRemove={remove}
          onCancel={() => setSelected(null)}
        />
      )}
      {conflicts.length > 0 && (
        <div role="alert" className={styles.notice}>
          <p>Jadwal bentrok:</p>
          <ul className={page.conflicts}>
            {conflicts.map((c, i) => (
              <li key={i}>{conflictText(c)}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function SlotEditor(props: {
  title: string;
  data: ScheduleData;
  lesson: ScheduleSlot | undefined;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const { data, lesson } = props;
  const [subject, setSubject] = useState(lesson?.subject.id ?? data.subjects[0]?.id ?? NEW_SUBJECT);
  return (
    <form className={page.editor} onSubmit={props.onSubmit} aria-label="Ubah pelajaran">
      <strong>{props.title}</strong>
      <div className={page.row}>
        <label className={forms.field}>
          <span className={forms.label}>Mapel</span>
          <select className={forms.input} name="subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SUBJECT}>+ Mapel baru…</option>
          </select>
        </label>
        {subject === NEW_SUBJECT && (
          <label className={forms.field}>
            <span className={forms.label}>Nama mapel baru</span>
            <input className={forms.input} name="newSubject" required minLength={2} maxLength={80} />
          </label>
        )}
        <label className={forms.field}>
          <span className={forms.label}>Guru</span>
          <select className={forms.input} name="teacher" defaultValue={lesson?.teacher?.id ?? ''}>
            <option value="">Belum ditentukan</option>
            {data.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={page.row}>
        <Button type="submit" disabled={props.busy}>
          Simpan
        </Button>
        {lesson && (
          <Button type="button" variant="secondary" disabled={props.busy} onClick={props.onRemove}>
            Kosongkan
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={props.busy} onClick={props.onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
