'use client';

import { UksStudentList, UksVisit, UksVisitList, type UksOutcome } from '@absah/contracts';
import { Button, DateInput } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { timeIn } from '@/lib/gate';
import { todayIn } from '@/lib/leave';
import { OUTCOME_LABELS, OUTCOMES } from '@/lib/uks';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

type Student = UksStudentList['items'][number];

/**
 * UKS (KSW-08): the petugas finds the student, writes the complaint and what was done, and picks
 * the outcome. "Dipulangkan" marks the rest of the day sakit and tells the parents, so it asks first.
 */
export default function UksPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [date, setDate] = useState(() => todayIn(timezone));
  const [visits, setVisits] = useState<UksVisitList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId || !date) return;
    api(`/uks/visits?date=${date}`, UksVisitList, { schoolId })
      .then((v) => {
        setVisits(v);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kunjungan UKS.'));
  }, [schoolId, date]);
  useEffect(load, [load]);

  const recorded = (visit: UksVisit) => {
    setNotice(
      visit.outcome === 'dipulangkan'
        ? `${visit.student.name} dicatat dipulangkan. Sisa pelajaran hari ini ditandai sakit dan orang tua diberi tahu.`
        : `Kunjungan ${visit.student.name} tersimpan.`,
    );
    load();
  };

  return (
    <IfCap name="student.uks" fallback={<p className={styles.main}>UKS belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>UKS</h1>
        {notice && <p role="status">{notice}</p>}
        <NewVisit schoolId={schoolId} onDone={recorded} />

        <section className={styles.section} aria-labelledby="kunjungan">
          <h2 id="kunjungan">Kunjungan</h2>
          <label className={forms.field}>
            Tanggal
            <DateInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {error && (
            <p className={forms.error} role="alert">
              {error}
            </p>
          )}
          {visits && visits.items.length === 0 && <p className={styles.empty}>Belum ada kunjungan.</p>}
          <ul className={ui.sessions}>
            {visits?.items.map((v) => (
              <li key={v.id} className={ui.student} aria-label={`Kunjungan ${v.student.name}`}>
                <span className={ui.studentName}>
                  {v.student.name} · {v.student.className}
                </span>
                <span>
                  {timeIn(timezone, v.visitedAt)} · {v.complaint}
                  {v.action ? ` · ${v.action}` : ''}
                </span>
                <span className={v.outcome === 'dipulangkan' ? styles.badgeWarn : styles.badge}>{OUTCOME_LABELS[v.outcome]}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </IfCap>
  );
}

function NewVisit({ schoolId, onDone }: { schoolId: string | null; onDone: (v: UksVisit) => void }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [complaint, setComplaint] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState<UksOutcome>('kembali_kelas');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per visit until it went through; any change makes it another visit.
  const key = useRef<string | null>(null);
  const changed = () => {
    key.current = null;
  };

  useEffect(() => {
    if (!schoolId || query.trim().length < 2 || student) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`/uks/students?q=${encodeURIComponent(query.trim())}`, UksStudentList, { schoolId, signal: controller.signal })
        .then((r) => setFound(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schoolId, query, student]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!student) return setError('Pilih siswa dulu.');
    if (complaint.trim().length < 2) return setError('Tulis keluhan siswa.');
    if (outcome === 'dipulangkan' && !window.confirm(`Pulangkan ${student.name}? Sisa pelajaran hari ini ditandai sakit dan orang tua diberi tahu lewat WhatsApp.`)) return;
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const body = { enrollmentId: student.enrollmentId, complaint, ...(action.trim() ? { action } : {}), outcome };
      onDone(await api('/uks/visits', UksVisit, { method: 'POST', schoolId, idempotencyKey: key.current, body }));
      key.current = null;
      setStudent(null);
      setQuery('');
      setFound([]);
      setComplaint('');
      setAction('');
      setOutcome('kembali_kelas');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} aria-labelledby="catat">
      <h2 id="catat">Catat kunjungan</h2>
      {student ? (
        <p>
          <strong>{student.name}</strong> · {student.className}{' '}
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              changed();
              setStudent(null);
            }}
          >
            Ganti siswa
          </Button>
        </p>
      ) : (
        <>
          <label className={forms.field}>
            Cari siswa
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik minimal 2 huruf nama" autoComplete="off" />
          </label>
          {query.trim().length >= 2 && (
            <ul className={ui.sessions} aria-label="Hasil pencarian">
              {found.map((s) => (
                <li key={s.enrollmentId}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      changed();
                      setStudent(s);
                    }}
                  >
                    {s.name} · {s.className}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <label className={forms.field}>
        Keluhan
        <input
          value={complaint}
          maxLength={500}
          onChange={(e) => {
            changed();
            setComplaint(e.target.value);
          }}
        />
      </label>
      <label className={forms.field}>
        Tindakan (boleh dikosongkan)
        <input
          value={action}
          maxLength={500}
          onChange={(e) => {
            changed();
            setAction(e.target.value);
          }}
        />
      </label>
      <fieldset className={forms.field}>
        <legend>Hasil</legend>
        {OUTCOMES.map((o) => (
          <label key={o}>
            <input
              type="radio"
              name="outcome"
              value={o}
              checked={outcome === o}
              onChange={() => {
                changed();
                setOutcome(o);
              }}
            />{' '}
            {OUTCOME_LABELS[o]}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan kunjungan'}
      </Button>
    </form>
  );
}
