'use client';

import { LearningGroup, LearningGroupDetail, ScheduleConflictDetail, StudentList, type LearningGroupDetail as Detail } from '@absah/contracts';
import { Button, Input, Select } from '@absah/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import { conflictText } from './grid';
import type { ScheduleData } from './page';

const Conflicts = z.object({ conflicts: z.array(ScheduleConflictDetail) });
type Member = Detail['members'][number];

/** Members of one group: tick students per rombel, save the whole list (PUT replaces it). */
function MembersEditor({ groupId, data, canEdit, onSaved }: { groupId: string; data: ScheduleData; canEdit: boolean; onSaved: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [group, setGroup] = useState<Detail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [classId, setClassId] = useState('');
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflictDetail[]>([]);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api(`/learning-groups/${groupId}`, LearningGroupDetail, { schoolId })
      .then((g) => {
        setGroup(g);
        setMembers(g.members);
      })
      .catch(() => setMessage({ ok: false, text: 'Tidak bisa memuat anggota.' }));
  }, [schoolId, groupId]);

  useEffect(() => {
    if (!schoolId || !classId) return;
    api(`/students?classId=${classId}&limit=100`, StudentList, { schoolId })
      .then((l) => setRoster(l.items.flatMap((s) => (s.enrollment ? [{ enrollmentId: s.enrollment.id, studentId: s.id, name: s.name, className: s.enrollment.className }] : []))))
      .catch(() => setMessage({ ok: false, text: 'Tidak bisa memuat siswa rombel.' }));
  }, [schoolId, classId]);

  const toggle = (m: Member, on: boolean) => {
    key.current = null; // another list = another request
    setMembers((prev) => (on ? [...prev, m] : prev.filter((x) => x.enrollmentId !== m.enrollmentId)));
  };

  async function save() {
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    setConflicts([]);
    try {
      await api(`/learning-groups/${groupId}/members`, LearningGroupDetail, { method: 'PUT', schoolId, idempotencyKey: key.current, body: { enrollmentIds: members.map((m) => m.enrollmentId) } });
      key.current = null;
      setMessage({ ok: true, text: `Anggota tersimpan: ${members.length} siswa.` });
      await onSaved();
    } catch (err) {
      const details = err instanceof ApiError && err.code === 'SCHEDULE_CONFLICT' ? Conflicts.safeParse(err.body.details) : null;
      if (details?.success) setConflicts(details.data.conflicts);
      else setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak bisa menyimpan. Coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  if (!group) return message ? <p role="alert">{message.text}</p> : <p role="status">Memuat…</p>;
  const chosen = new Set(members.map((m) => m.enrollmentId));
  return (
    <section className={styles.section} aria-label={`Anggota ${group.name}`}>
      <h2>
        Anggota {group.name} ({members.length})
      </h2>
      <ul>
        {members.map((m) => (
          <li key={m.enrollmentId}>
            {m.name} · {m.className}{' '}
            {canEdit && (
              <button type="button" onClick={() => toggle(m, false)} aria-label={`Keluarkan ${m.name}`}>
                Keluarkan
              </button>
            )}
          </li>
        ))}
      </ul>
      {members.length === 0 && <p className={styles.muted}>Belum ada anggota.</p>}
      {canEdit && (
        <>
          <label className={forms.field}>
            <span className={forms.label}>Tambah dari rombel</span>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Pilih rombel…</option>
              {data.classes.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          {classId && roster && (
            <fieldset>
              <legend>Siswa rombel ini</legend>
              {roster.map((m) => (
                <p key={m.enrollmentId}>
                  <label>
                    <input type="checkbox" checked={chosen.has(m.enrollmentId)} onChange={(e) => toggle(m, e.target.checked)} /> {m.name}
                  </label>
                </p>
              ))}
            </fieldset>
          )}
          <p>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan anggota'}
            </Button>
          </p>
        </>
      )}
      {conflicts.length > 0 && (
        <div role="alert">
          <p>Bentrok dengan jadwal lain:</p>
          <ul>
            {conflicts.map((c, i) => (
              <li key={i}>{conflictText(c)}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </section>
  );
}

/** Kelompok belajar (AKD-10): mapel pilihan or moving class across rombel; lessons go in the grid. */
export function GroupsTab({ data, canEdit, onChanged }: { data: ScheduleData; canEdit: boolean; onChanged: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    const body = { name: String(form.get('name') ?? '').trim(), subjectId: String(form.get('subject') ?? ''), teacherId: String(form.get('teacher') ?? '') || null };
    api('/learning-groups', LearningGroup, { method: 'POST', schoolId, idempotencyKey: key.current, body })
      .then(async (g) => {
        key.current = null;
        formEl.reset();
        await onChanged();
        setOpen(g.id);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa membuat kelompok. Coba lagi.'))
      .finally(() => setBusy(false));
  };

  return (
    <section>
      <p className={styles.muted}>Siswa kelompok belajar tetap tercatat di rombelnya sendiri. Atur jam pelajarannya di tab Jadwal pelajaran.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Kelompok belajar">
          <thead>
            <tr>
              <th>Kelompok</th>
              <th>Mapel</th>
              <th>Guru</th>
              <th className={styles.num}>Anggota</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map((g) => (
              <tr key={g.id}>
                <td>
                  <button type="button" onClick={() => setOpen(g.id)} aria-pressed={open === g.id}>
                    {g.name}
                  </button>
                </td>
                <td>{g.subject.name}</td>
                <td>{g.teacher?.name ?? <span className={styles.muted}>Belum ada</span>}</td>
                <td className={styles.num}>{g.memberCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.groups.length === 0 && <p className={styles.empty}>Belum ada kelompok belajar.</p>}
      </div>
      {open && <MembersEditor key={open} groupId={open} data={data} canEdit={canEdit} onSaved={onChanged} />}
      {canEdit && (
        <form className={styles.section} onSubmit={create} onChange={() => (key.current = null)} aria-label="Kelompok baru">
          <h2>Kelompok baru</h2>
          <label className={forms.field}>
            <span className={forms.label}>Nama kelompok</span>
            <Input name="name" required minLength={2} maxLength={80} placeholder="Fisika A" />
          </label>
          <label className={forms.field}>
            <span className={forms.label}>Mapel</span>
            <Select name="subject" required>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className={forms.field}>
            <span className={forms.label}>Guru</span>
            <Select name="teacher">
              <option value="">Belum ditentukan</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </label>
          {data.subjects.length === 0 && <p className={styles.notice}>Tambahkan mapel dulu lewat tab Jadwal pelajaran.</p>}
          <Button type="submit" disabled={busy || data.subjects.length === 0}>
            {busy ? 'Menyimpan…' : 'Buat kelompok'}
          </Button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
