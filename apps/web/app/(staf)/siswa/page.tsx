'use client';

import { ClassList, StudentList, StudentListItem } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { STUDENT_MANAGERS, STUDENT_READERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

type Status = 'active' | 'missing' | 'all';
const STATUS_LABELS: Record<Status, string> = { active: 'Aktif', missing: 'Calon keluar', all: 'Semua' };

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Student registry (AKD-01): search, rombel filter, and settling calon keluar students. */
function StudentsView() {
  const params = useSearchParams();
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole(...STUDENT_READERS);
  const canManage = hasRole(...STUDENT_MANAGERS);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>(params.get('status') === 'missing' ? 'missing' : 'active');
  const [classId, setClassId] = useState(params.get('rombel') ?? '');
  const [classes, setClasses] = useState<ClassList['items']>([]);
  const [items, setItems] = useState<StudentListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const term = useDebounced(q.trim());

  const load = useCallback(
    async (after: string | null) => {
      if (!schoolId) return;
      const query = new URLSearchParams({ status, limit: '50' });
      if (term) query.set('q', term);
      if (classId) query.set('classId', classId);
      if (after) query.set('cursor', after);
      const page = await api(`/students?${query.toString()}`, StudentList, { schoolId });
      setItems((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    },
    [schoolId, status, term, classId],
  );

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api('/classes', ClassList, { schoolId })
      .then((c) => setClasses(c.items))
      .catch(() => undefined);
  }, [schoolId, allowed]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError(null);
        return load(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat data siswa.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, allowed]);

  async function settle(student: StudentListItem, next: 'active' | 'moved' | 'left') {
    if (!schoolId || !student.enrollment) return;
    const ask = { active: 'masih bersekolah', moved: 'pindah sekolah', left: 'lulus atau keluar' }[next];
    if (next !== 'active' && !window.confirm(`Tandai ${student.name} ${ask}? Siswa tidak lagi masuk daftar presensi.`)) return;
    setBusy(student.id);
    try {
      const updated = await api(`/enrollments/${student.enrollment.id}`, StudentListItem, {
        method: 'PATCH',
        body: { status: next },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      setItems((list) => (status === 'missing' ? list.filter((s) => s.id !== student.id) : list.map((s) => (s.id === student.id ? updated : s))));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Perubahan tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  if (!allowed) {
    return (
      <main className={styles.main}>
        <p>Halaman ini untuk admin, operator, dan pimpinan sekolah.</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Data siswa</h1>
      <div className={styles.toolbar}>
        <label className={forms.field}>
          <span className={forms.label}>Cari</span>
          <input className={forms.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama, NISN, atau NIPD" />
        </label>
        <label className={forms.field}>
          <span className={forms.label}>Rombel</span>
          <select className={forms.input} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Semua rombel</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={forms.field}>
          <span className={forms.label}>Status</span>
          <select className={forms.input} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {status === 'missing' && (
        <p className={styles.notice}>
          Siswa ini tidak ada di import Dapodik terakhir. Pastikan statusnya: tetap bersekolah, pindah, atau lulus/keluar.
        </p>
      )}
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.tableWrap}>
        {items.length === 0 ? (
          <p className={styles.empty} role="status">
            {loading ? 'Memuat…' : 'Tidak ada siswa yang cocok.'}
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NISN</th>
                <th>Rombel</th>
                <th>Status</th>
                {canManage && <th>Kontak</th>}
                {canManage && status !== 'active' && <th>Tindak lanjut</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className={s.nisn ? undefined : styles.muted}>{s.nisn ?? 'belum ada'}</td>
                  <td className={s.enrollment ? undefined : styles.muted}>{s.enrollment?.className ?? 'tanpa rombel'}</td>
                  <td>
                    {s.enrollment?.missingSince ? (
                      <span className={styles.badgeWarn}>Calon keluar</span>
                    ) : s.enrollment ? (
                      <span className={styles.badgeOk}>Aktif</span>
                    ) : (
                      <span className={styles.muted}>Tidak aktif</span>
                    )}
                  </td>
                  {canManage && (
                    <td>
                      <Link href={`/siswa/kontak?id=${s.id}`} aria-label={`Kontak WhatsApp ${s.name}`}>
                        Kontak
                      </Link>
                    </td>
                  )}
                  {canManage && status !== 'active' && (
                    <td>
                      {s.enrollment?.missingSince && (
                        <div className={styles.rowActions}>
                          <Button variant="secondary" disabled={busy === s.id} onClick={() => void settle(s, 'active')}>
                            Masih bersekolah
                          </Button>
                          <Button variant="secondary" disabled={busy === s.id} onClick={() => void settle(s, 'moved')}>
                            Pindah sekolah
                          </Button>
                          <Button variant="secondary" disabled={busy === s.id} onClick={() => void settle(s, 'left')}>
                            Lulus/keluar
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {cursor && (
        <div className={styles.more}>
          <Button variant="secondary" onClick={() => void load(cursor)}>
            Muat lebih banyak
          </Button>
        </div>
      )}
    </main>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<p role="status">Memuat…</p>}>
      <StudentsView />
    </Suspense>
  );
}
