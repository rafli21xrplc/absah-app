'use client';

import { LoadingState } from '@absah/ui';
import { MyExams, type MyExam } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { loadKeys } from '@/lib/card';
import { IfCap } from '@/lib/capabilities';
import { examCardView, examWindowLabel, reasonLabel } from '@/lib/exam';
import { todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import { CardQr } from '../../card-qr';
import styles from '../../portal.module.css';

/** Kartu ujian (UJN-01/03): where to sit, whether the child may sit, and on exam day the same card QR the gate reads. */
export default function PortalUjian() {
  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>Kartu ujian</h1>
      <IfCap name="exam.enabled" fallback={<p>Sekolah belum memakai kartu ujian.</p>}>
        <Exams />
      </IfCap>
    </main>
  );
}

function Exams() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [list, setList] = useState<MyExams | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/exam/mine', MyExams, { schoolId })
      .then(setList)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kartu ujian.'));
  }, [schoolId]);

  const today = todayIn(timezone);
  const open = list?.items.filter((e) => examCardView(e, today) !== 'over') ?? [];
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!list && !error && <LoadingState />}
      {list && open.length === 0 && <p>Belum ada ujian yang akan datang.</p>}
      {open.map((e) => (
        <ExamCard key={`${e.enrollmentId}|${e.period.id}`} exam={e} view={examCardView(e, today)} />
      ))}
    </>
  );
}

function ExamCard({ exam, view }: { exam: MyExam; view: ReturnType<typeof examCardView> }) {
  const first = exam.student.name.split(/\s+/)[0] ?? exam.student.name;
  // The keys live on the phone that activated the daily card (the portal home); no keys here means that was never done.
  const [keys] = useState(() => loadKeys(`absah.card.${exam.studentId}`));
  return (
    <section className={styles.card} aria-label={`Ujian ${first}`}>
      <h2>
        {exam.period.name} <span className={styles.muted}>· {first}, {exam.className}</span>
      </h2>
      <p>{examWindowLabel(exam.period.startsOn, exam.period.endsOn)}</p>
      <p>{exam.room ? `Ruang ${exam.room.name}, tempat duduk nomor ${exam.room.seatNo}.` : 'Ruang belum diatur sekolah.'}</p>
      {view === 'arrived' && <p role="status">{first} sudah tercatat hadir di ruang ujian.</p>}
      {view === 'blocked' && (
        <div role="alert">
          <p>
            <strong>{first} belum boleh ujian.</strong>
          </p>
          <ul>
            {exam.reasons.map((r, i) => (
              <li key={i}>{reasonLabel(r)}</li>
            ))}
          </ul>
          <p>Hubungi sekolah untuk menyelesaikannya.</p>
        </div>
      )}
      {view === 'before' && !exam.eligible && (
        <div role="status">
          <p>Saat ini {first} belum memenuhi syarat ujian:</p>
          <ul>
            {exam.reasons.map((r, i) => (
              <li key={i}>{reasonLabel(r)}</li>
            ))}
          </ul>
        </div>
      )}
      {view === 'before' && exam.eligible && <p role="status">{first} boleh ujian. Kartu muncul di sini pada hari ujian.</p>}
      {view === 'show' &&
        (keys ? (
          <>
            <p role="status">
              <strong>{first} boleh ujian.</strong> Tunjukkan kartu ini kepada pengawas.
            </p>
            <CardQr keys={keys} name={first} />
          </>
        ) : (
          <p role="status">
            {first} boleh ujian. Aktifkan kartu di <Link href="/portal">beranda portal</Link> pada HP ini, lalu buka halaman ini lagi.
          </p>
        ))}
    </section>
  );
}
