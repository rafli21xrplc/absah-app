'use client';

import { ClassList, EligibilityList, ExamPeriod, ExamPeriodList } from '@absah/contracts';
import { Button, EmptyState, Select, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { EXAM_MANAGING, EXAM_VIEWING, examWindowLabel, formFromPeriod, periodBody, reasonLabel, ruleSummary, type PeriodForm } from '@/lib/exam';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';
import { PeriodFormFields } from '../period-form';

/** One exam: its rule, who may not sit yet and why (for the wali kelas to act on), and the way to its rooms. */
function PeriodView({ id }: { id: string }) {
  const { schoolId, hasRole } = useWorkspace();
  const manage = hasRole(...EXAM_MANAGING);
  const [period, setPeriod] = useState<ExamPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!schoolId) return;
    // There is no single-period read: the list (with the closed ones) holds it.
    api('/exam/periods?includeClosed=true', ExamPeriodList, { schoolId })
      .then((r) => {
        const found = r.items.find((p) => p.id === id);
        if (found) setPeriod(found);
        else setError('Ujian tidak ditemukan.');
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat ujian.'));
  }, [schoolId, id]);
  useEffect(load, [load]);

  async function save(fields: object) {
    setBusy(true);
    setSaveError(null);
    try {
      setPeriod(await api(`/exam/periods/${id}`, ExamPeriod, { method: 'PATCH', schoolId, idempotencyKey: newIdempotencyKey(), body: fields }));
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/ujian">
        ← Ujian
      </Link>
      {error && <p role="alert">{error}</p>}
      {!period && !error && <LoadingState variant="table" />}
      {period && (
        <>
          <h1 className={styles.title}>{period.name}</h1>
          <p>
            {examWindowLabel(period.startsOn, period.endsOn)} · {period.academicYear.name}
            {period.closed && <span className={styles.badge}> Ditutup</span>}
          </p>
          <p>{ruleSummary(period)}</p>
          {manage && !editing && (
            <p className={styles.rowActions}>
              <Button variant="secondary" type="button" onClick={() => setEditing(true)}>
                Ubah aturan
              </Button>
              <Button variant="secondary" type="button" disabled={busy} onClick={() => void save({ closed: !period.closed })}>
                {period.closed ? 'Buka lagi' : 'Tutup ujian'}
              </Button>
            </p>
          )}
          {saveError && !editing && <p role="alert">{saveError}</p>}
          {manage && editing && (
            <section className={styles.section} aria-labelledby="ubah">
              <h2 id="ubah">Ubah aturan</h2>
              <PeriodFormFields initial={formFromPeriod(period)} submitLabel="Simpan perubahan" busy={busy} error={saveError} onSubmit={(f: PeriodForm) => void save(periodBody(f))} />
              <Button variant="secondary" type="button" onClick={() => setEditing(false)}>
                Batal
              </Button>
            </section>
          )}
          <p>
            <Link href={`/ujian/${period.id}/ruang`}>Ruang ujian →</Link>
          </p>
          <Eligibility periodId={period.id} />
        </>
      )}
    </main>
  );
}

function Eligibility({ periodId }: { periodId: string }) {
  const { schoolId, hasRole } = useWorkspace();
  const seesAll = hasRole('wakasek', 'kepsek', 'admin');
  const [classes, setClasses] = useState<ClassList['items']>([]);
  const [classId, setClassId] = useState('');
  const [all, setAll] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; data: EligibilityList } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const key = `${periodId}|${classId}|${all}`;

  useEffect(() => {
    if (!schoolId || !seesAll) return;
    api('/classes', ClassList, { schoolId }).then((r) => setClasses(r.items)).catch(() => undefined);
  }, [schoolId, seesAll]);

  useEffect(() => {
    if (!schoolId) return;
    const q = new URLSearchParams({ show: all ? 'all' : 'ineligible' });
    if (classId) q.set('classId', classId);
    api(`/exam/periods/${periodId}/eligibility?${q}`, EligibilityList, { schoolId })
      .then((data) => setLoaded({ key, data }))
      .catch((err: unknown) => setFailed({ key, message: err instanceof ApiError ? err.message : 'Tidak bisa memuat daftar.' }));
  }, [schoolId, periodId, classId, all, key]);

  const data = loaded?.key === key ? loaded.data : null;
  const error = failed?.key === key ? failed.message : null;

  return (
    <section className={styles.section} aria-labelledby="boleh">
      <h2 id="boleh">Boleh ujian</h2>
      <form className={styles.toolbar} aria-label="Saring daftar" onSubmit={(e) => e.preventDefault()}>
        {seesAll && (
          <label>
            Rombel{' '}
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Semua rombel</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label>
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Tampilkan semua siswa
        </label>
      </form>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <LoadingState variant="table" />}
      {data && (
        <>
          <p role="status">
            {data.counts.eligible} dari {data.counts.students} siswa boleh ujian · <strong>{data.counts.ineligible} belum boleh</strong>
          </p>
          {data.items.length === 0 && <EmptyState bare headingLevel="p" kind="done" title={all ? 'Tidak ada siswa.' : 'Semua siswa boleh ujian.'} />}
          <ul className={ui.sessions}>
            {data.items.map((i) => (
              <li key={i.enrollmentId} className={ui.student} aria-label={i.student.name}>
                <span className={ui.studentName}>
                  {i.student.name} <span className={styles.muted}>· {i.className}</span>
                </span>
                {i.eligible ? <span className={styles.badgeOk}>Boleh ujian</span> : <span className={styles.badgeBad}>Belum boleh</span>}
                {i.reasons.length > 0 && <span>{i.reasons.map(reasonLabel).join(' · ')}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="exam.enabled" fallback={<p className={styles.main}>Ujian belum diaktifkan.</p>}>
      {hasRole(...EXAM_VIEWING) ? <PeriodView id={id} /> : <p className={styles.main}>Halaman ini untuk pimpinan sekolah dan wali kelas.</p>}
    </IfCap>
  );
}
