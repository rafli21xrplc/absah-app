'use client';

import { DAY_NAMES, ScheduleConflictDetail, ScheduleResponse, ScheduleSlot, Subject } from '@absah/contracts';
import { Button, Drawer, Field, Input, Select, WeekGrid, messages, type WeekGridRow } from '@absah/ui';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import type { ScheduleData } from './page';

const t = messages.schedule;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
const dotted = (hhmm: string) => hhmm.replace(':', '.');

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

/** "class:<id>" or "group:<id>": whose lessons the grid shows. */
type Owner = `${'class' | 'group'}:${string}`;
const ownerOf = (value: Owner) => {
  const [type, id] = value.split(':') as ['class' | 'group', string];
  return { type, id };
};

/**
 * Weekly grid of one rombel or learning group (AKD-10): days across, jam down. A cell opens the lesson in a drawer; a clash is
 * said in the drawer, in words, with who is already teaching. Not here because the server has no endpoint: Terbitkan jadwal,
 * Per guru, Per ruang, beban JP per mapel.
 */
export function ScheduleGrid({ data, canEdit, onChanged }: { data: ScheduleData; canEdit: boolean; onChanged: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [owner, setOwner] = useState<Owner>(`class:${data.classes.items[0]?.id ?? ''}`);
  const { type: ownerType, id: ownerId } = ownerOf(owner);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflictDetail[]>([]);
  const [busy, setBusy] = useState(false);
  const actionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId || !ownerId) return;
    api(`/schedule?${ownerType === 'class' ? 'classId' : 'groupId'}=${ownerId}`, ScheduleResponse, { schoolId })
      .then((r) => setSlots(r.slots))
      .catch(() => setError(t.slotsFailed));
  }, [schoolId, ownerType, ownerId]);

  const days = data.periods.days.filter((d) => d.periods.length > 0);
  const numbers = useMemo(() => [...new Set(days.flatMap((d) => d.periods.map((p) => p.number)))].sort((a, b) => a - b), [days]);
  const at = (c: Cell) => slots.find((s) => s.day === c.day && s.period === c.period);
  const lesson = selected ? at(selected) : undefined;

  if (days.length === 0) {
    return <p className="m-0 text-body text-tinta-muted">{t.noPeriods}</p>;
  }

  const rows: WeekGridRow[] = numbers.map((n) => ({
    number: n,
    cells: days.map((d) => {
      const period = d.periods.find((p) => p.number === n);
      if (!period) return null;
      const s = at({ day: d.day, period: n });
      return {
        time: `${dotted(period.startsAt)}–${dotted(period.endsAt)}`,
        subject: s?.subject.name,
        teacher: s?.teacher?.name,
        label: fill(t.cellOf, { day: DAY_NAMES[d.day] ?? '', n, subject: s ? s.subject.name : t.emptyCell }),
        selected: selected?.day === d.day && selected.period === n,
      };
    }),
  }));

  function pick(dayIndex: number, period: number) {
    const day = days[dayIndex];
    if (!day) return;
    actionKey.current = null;
    setSelected({ day: day.day, period });
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
      else setError(err instanceof ApiError ? err.message : t.saveFailed);
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
      const body = { ownerType, ownerId, day: selected.day, period: selected.period, subjectId, teacherId };
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
    <section className="flex flex-col gap-4">
      <Field label={data.groups.length > 0 ? t.ownerOrGroupLabel : t.ownerLabel} className="max-w-xs">
        <Select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value as Owner);
            setSelected(null);
          }}
        >
          {data.classes.items.map((c) => (
            <option key={c.id} value={`class:${c.id}`}>
              {c.name}
            </option>
          ))}
          {data.groups.length > 0 && (
            <optgroup label={t.groupsOptgroup}>
              {data.groups.map((g) => (
                <option key={g.id} value={`group:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </Field>
      <WeekGrid label={t.gridLabel} days={days.map((d) => DAY_NAMES[d.day] ?? '')} rows={rows} disabled={!canEdit} onPick={pick} />
      {error && !selected && (
        <p role="alert" className="m-0 text-body text-alpa">
          {error}
        </p>
      )}
      {canEdit && (
        <Drawer
          open={selected !== null}
          onOpenChange={(open) => !open && !busy && setSelected(null)}
          title={selected ? fill(t.drawerTitle, { day: DAY_NAMES[selected.day] ?? '', n: selected.period }) : t.drawerTitle}
          onSubmit={save}
          actions={
            <>
              {lesson && (
                <Button type="button" variant="secondary" disabled={busy} onClick={remove}>
                  {t.clear}
                </Button>
              )}
              <Button type="submit" loading={busy}>
                {t.save}
              </Button>
            </>
          }
        >
          {selected && <SlotFields key={`${owner}-${selected.day}-${selected.period}`} data={data} lesson={lesson} />}
          {conflicts.length > 0 && (
            <div role="alert" className="flex flex-col gap-1 rounded-md border border-alpa bg-alpa-soft p-3 text-body text-tinta">
              <p className="m-0 text-body-strong">{t.conflictTitle}</p>
              <ul className="m-0 pl-5">
                {conflicts.map((c, i) => (
                  <li key={i}>{conflictText(c)}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p role="alert" className="m-0 text-body text-alpa">
              {error}
            </p>
          )}
        </Drawer>
      )}
    </section>
  );
}

/** The fields of one slot. Read from the surrounding form on save (named inputs), so the drawer owns submit and busy. */
function SlotFields({ data, lesson }: { data: ScheduleData; lesson: ScheduleSlot | undefined }) {
  const [subject, setSubject] = useState(lesson?.subject.id ?? data.subjects[0]?.id ?? NEW_SUBJECT);
  return (
    <>
      <Field label={t.subjectLabel}>
        <Select name="subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {data.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={NEW_SUBJECT}>{t.newSubjectOption}</option>
        </Select>
      </Field>
      {subject === NEW_SUBJECT && (
        <Field label={t.newSubjectLabel}>
          <Input name="newSubject" required minLength={2} maxLength={80} autoComplete="off" />
        </Field>
      )}
      <Field label={t.teacherLabel}>
        <Select name="teacher" defaultValue={lesson?.teacher?.id ?? ''}>
          <option value="">{t.noTeacher}</option>
          {data.teachers.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
