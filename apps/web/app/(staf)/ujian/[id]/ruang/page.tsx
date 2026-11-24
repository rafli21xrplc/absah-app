'use client';

import { ClassList, ExamRoom, ExamRoomList, SeatStudentsResult, SchoolMembersResponse } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { z } from 'zod';
import { use, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { EXAM_MANAGING, EXAM_VIEWING } from '@/lib/exam';
import { staffCandidates } from '@/lib/tppk';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../../forms.module.css';
import styles from '../../../data.module.css';

/** Ruang ujian (UJN-03): rooms of one exam, their pengawas, and who sits where (a whole rombel at a time). */
function Rooms({ periodId }: { periodId: string }) {
  const { schoolId, hasRole } = useWorkspace();
  const manage = hasRole(...EXAM_MANAGING);
  const [list, setList] = useState<ExamRoomList | null>(null);
  const [classes, setClasses] = useState<ClassList['items']>([]);
  const [staff, setStaff] = useState<{ userId: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/exam/periods/${periodId}/rooms`, ExamRoomList, { schoolId })
      .then(setList)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat ruang.'));
  }, [schoolId, periodId]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!schoolId || !manage) return;
    api('/classes', ClassList, { schoolId }).then((r) => setClasses(r.items)).catch(() => undefined);
    api('/school/members', SchoolMembersResponse, { schoolId }).then((r) => setStaff(staffCandidates(r.items))).catch(() => setStaff([]));
  }, [schoolId, manage]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const size = capacity.trim() === '' ? null : Number(capacity);
    if (!name.trim()) return setError('Tulis nama ruang.');
    if (size !== null && (!Number.isInteger(size) || size < 1 || size > 500)) return setError('Kapasitas harus bilangan bulat 1 sampai 500.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      await api(`/exam/periods/${periodId}/rooms`, ExamRoom, { method: 'POST', schoolId, idempotencyKey: key.current, body: { name: name.trim(), capacity: size, supervisorId: supervisorId || null } });
      key.current = null;
      setName('');
      setCapacity('');
      setSupervisorId('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function seat(room: ExamRoom, classId: string) {
    if (!classId) return;
    setError(null);
    setNotice(null);
    try {
      const r = await api(`/exam/rooms/${room.id}/students`, SeatStudentsResult, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { classId } });
      setNotice(`${room.name}: ${r.added} siswa ditambahkan, ${r.moved} dipindah dari ruang lain, ${r.unchanged} sudah di sini. Terisi ${r.seated}.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError && (err.body.details as { reason?: string } | undefined)?.reason === 'room_full' ? `Ruang ${room.name} tidak muat; tidak ada yang dipindahkan.` : err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal.');
    }
  }

  async function remove(room: ExamRoom) {
    if (!window.confirm(`Hapus ruang ${room.name}? Tempat duduk di dalamnya ikut terhapus.`)) return;
    setError(null);
    try {
      await api(`/exam/rooms/${room.id}`, z.null(), { method: 'DELETE', schoolId, idempotencyKey: newIdempotencyKey() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terhapus. Periksa sinyal.');
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href={`/ujian/${periodId}`}>
        ← Ujian
      </Link>
      <h1 className={styles.title}>Ruang ujian</h1>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!list && !error && <p role="status">Memuat…</p>}
      {list && (
        <p role="status">
          {list.unseated > 0 ? <strong>{list.unseated} siswa belum punya ruang.</strong> : 'Semua siswa sudah punya ruang.'}
        </p>
      )}
      {list && list.items.length === 0 && <p className={styles.empty}>Belum ada ruang.</p>}
      <ul>
        {list?.items.map((r) => (
          <li key={r.id} aria-label={r.name}>
            <Link href={`/ujian/ruang/${r.id}`}>{r.name}</Link> · {r.seated}
            {r.capacity !== null ? ` dari ${r.capacity}` : ''} siswa · pengawas: {r.supervisor?.name ?? 'belum ada'}
            {manage && (
              <>
                {' '}
                <label>
                  Isi dengan rombel{' '}
                  <select value="" aria-label={`Isi ${r.name} dengan rombel`} onChange={(e) => void seat(r, e.target.value)}>
                    <option value="">Pilih rombel…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>{' '}
                <Button variant="secondary" type="button" onClick={() => void remove(r)}>
                  Hapus
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <form onSubmit={(e) => void create(e)} aria-label="Ruang baru">
          <h2>Ruang baru</h2>
          <label className={forms.field}>
            Nama ruang
            <input value={name} maxLength={40} placeholder="R1" onChange={(e) => { key.current = null; setName(e.target.value); }} />
          </label>
          <label className={forms.field}>
            Kapasitas (boleh dikosongkan)
            <input inputMode="numeric" value={capacity} maxLength={3} onChange={(e) => { key.current = null; setCapacity(e.target.value); }} />
          </label>
          <label className={forms.field}>
            Pengawas
            <select value={supervisorId} onChange={(e) => { key.current = null; setSupervisorId(e.target.value); }}>
              <option value="">Belum ditentukan</option>
              {staff.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={busy}>
            Tambah ruang
          </Button>
        </form>
      )}
    </main>
  );
}

export default function RoomsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="exam.enabled" fallback={<p className={styles.main}>Ujian belum diaktifkan.</p>}>
      {hasRole(...EXAM_VIEWING) ? <Rooms periodId={id} /> : <p className={styles.main}>Halaman ini untuk pimpinan sekolah dan wali kelas.</p>}
    </IfCap>
  );
}
