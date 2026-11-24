'use client';

import { MemorizationLog, MemorizationStudentList, surahLabel } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { ayatIn, MEMORIZATION_WRITERS, optionalInt, SURAH_OPTIONS } from '@/lib/memorization';
import { useWorkspace } from '@/lib/workspace';
import { HafalanHistory } from '../../_hafalan/history';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

type Student = MemorizationStudentList['items'][number];

/** Setoran hafalan (KEG-03): the guru tahfidz finds the student and records what was recited. */
export default function HafalanPage() {
  const { schoolId, hasRole } = useWorkspace();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [surah, setSurah] = useState(1);
  const [saved, setSaved] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per setoran until it went through; any change makes it another one.
  const key = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId || query.trim().length < 2 || student) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`/memorization-logs/students?q=${encodeURIComponent(query.trim())}`, MemorizationStudentList, { schoolId, signal: controller.signal })
        .then((r) => setFound(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schoolId, query, student]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!student) return;
    const formEl = e.currentTarget;
    const d = new FormData(formEl);
    const body = {
      studentId: student.studentId,
      surah,
      ayatFrom: Number(d.get('ayatFrom')),
      ayatTo: Number(d.get('ayatTo')),
      juz: optionalInt(String(d.get('juz') ?? '')),
      score: optionalInt(String(d.get('score') ?? '')),
      note: String(d.get('note') ?? '').trim() || undefined,
    };
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const log = await api('/memorization-logs', MemorizationLog, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      key.current = null;
      formEl.reset();
      setSaved(`Setoran ${surahLabel(log.surah, log.ayatFrom, log.ayatTo)} tersimpan.`);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  const max = ayatIn(surah);
  return (
    <IfCap name="religious.memorization" fallback={<p className={styles.main}>Hafalan belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Setoran hafalan</h1>
        {!hasRole(...MEMORIZATION_WRITERS) && <p>Halaman ini untuk guru tahfidz.</p>}
        {hasRole(...MEMORIZATION_WRITERS) && !student && (
          <>
            <label className={forms.field}>
              Cari siswa
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik minimal 2 huruf nama" autoComplete="off" />
            </label>
            {query.trim().length >= 2 && (
              <ul className={ui.sessions} aria-label="Hasil pencarian">
                {found.map((s) => (
                  <li key={s.studentId}>
                    <Button variant="secondary" onClick={() => setStudent(s)}>
                      {s.name} · {s.className}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {student && schoolId && (
          <>
            <p>
              <strong>{student.name}</strong> · {student.className}{' '}
              <Button
                variant="secondary"
                onClick={() => {
                  key.current = null;
                  setStudent(null);
                  setSaved(null);
                }}
              >
                Ganti siswa
              </Button>
            </p>
            <form className={styles.section} onSubmit={(e) => void submit(e)} onChange={() => (key.current = null)} aria-labelledby="setoran">
              <h2 id="setoran">Setoran baru</h2>
              <label className={forms.field}>
                <span className={forms.label}>Surah</span>
                <select className={forms.input} value={surah} onChange={(e) => setSurah(Number(e.target.value))}>
                  {SURAH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Ayat awal</span>
                <input className={forms.input} name="ayatFrom" type="number" inputMode="numeric" min={1} max={max} required />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Ayat akhir</span>
                <input className={forms.input} name="ayatTo" type="number" inputMode="numeric" min={1} max={max} required />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Juz (boleh kosong)</span>
                <input className={forms.input} name="juz" type="number" inputMode="numeric" min={1} max={30} />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Nilai 0–100 (boleh kosong)</span>
                <input className={forms.input} name="score" type="number" inputMode="numeric" min={0} max={100} />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Catatan</span>
                <textarea className={forms.input} name="note" maxLength={500} rows={2} />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? 'Menyimpan…' : 'Simpan setoran'}
              </Button>
              {error && (
                <p className={forms.error} role="alert">
                  {error}
                </p>
              )}
              {saved && <p role="status">{saved}</p>}
            </form>
            <HafalanHistory className={styles.section} schoolId={schoolId} studentId={student.studentId} reload={reload} />
          </>
        )}
      </main>
    </IfCap>
  );
}
