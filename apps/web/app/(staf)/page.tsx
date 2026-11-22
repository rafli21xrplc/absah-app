'use client';

import { SchoolSetupResponse } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { IfCap, useCapability } from '@/lib/capabilities';
import { LEVEL_LABELS } from '@/lib/levels';
import { CORRECTION_DECIDERS } from '@/lib/attendance';
import { GATE_VIEWERS } from '@/lib/gate';
import { HABIT_SUMMARY_READERS } from '@/lib/habits';
import { JOURNAL_VIEWERS } from '@/lib/journal';
import { VISITOR_VIEWERS } from '@/lib/visitors';
import { BK_READERS, EARLY_WARNING_READERS, FOLLOWUP_READERS, POINT_RECORDERS } from '@/lib/ksw';
import { SUBSTITUTION_READING, TEACHER_CHECKIN, TEACHER_LEAVE_DECIDING, TEACHER_REPORT_READING } from '@/lib/teacher';
import { UKS_STAFF } from '@/lib/uks';
import { MEMORIZATION_WRITERS } from '@/lib/memorization';
import { MBG_READERS } from '@/lib/mbg';
import { BILLING_READERS } from '@/lib/billing';
import { STUDENT_BILLING_READING } from '@/lib/student-billing';
import { EXAM_VIEWING } from '@/lib/exam';
import { NOTIFY_VIEWERS } from '@/lib/notify';
import { RECAP_READERS } from '@/lib/report';
import { SCHEDULE_PAGE_READERS } from '@/lib/schedule-access';
import { STUDENT_MANAGERS, STUDENT_READERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';
import styles from '../shell.module.css';
import { MbgCard } from './mbg/card';
import { TppkCards } from './tppk/card';

export default function StafHome() {
  const router = useRouter();
  const { me, schoolId, isAdmin, hasRole, selectSchool } = useWorkspace();
  const dataSource = useCapability('data.source');
  const mode = useCapability('attendance.mode');
  const kaih = useCapability('habits.kaih');
  const school = me.schools.find((s) => s.id === schoolId);

  // A new school's admin lands in the setup wizard until it is finished.
  useEffect(() => {
    if (!schoolId || !isAdmin) return;
    api('/school/setup', SchoolSetupResponse, { schoolId })
      .then((setup) => {
        if (!setup.completedAt) router.replace('/setup');
      })
      .catch(() => undefined);
  }, [schoolId, isAdmin, router]);

  if (me.schools.length === 0) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Belum ada sekolah</h1>
        <p>Akun Anda belum terdaftar di sekolah mana pun. Minta tautan undangan dari admin sekolah.</p>
      </main>
    );
  }

  if (!school) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Pilih sekolah</h1>
        <div className={styles.list}>
          {me.schools.map((s) => (
            <Button key={s.id} variant="secondary" onClick={() => selectSchool(s.id)}>
              {s.name} · {LEVEL_LABELS[s.level]}
            </Button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>
        {school.name} · {LEVEL_LABELS[school.level]}
      </p>
      <h1 className={styles.title}>Halo, {me.user.name}</h1>
      <nav className={styles.list} aria-label="Menu">
        <Link className={styles.card} href="/hari-ini">
          Presensi hari ini
        </Link>
        <Link className={styles.card} href="/izin">
          Izin siswa
        </Link>
        <Link className={styles.card} href="/koreksi">
          {hasRole(...CORRECTION_DECIDERS) ? 'Koreksi presensi' : 'Koreksi saya'}
        </Link>
        {hasRole(...JOURNAL_VIEWERS) && mode === 'per_period' && (
          <Link className={styles.card} href="/jurnal">
            Jurnal mengajar
          </Link>
        )}
        <Link className={styles.card} href="/kegiatan">
          Kegiatan
        </Link>
        <IfCap name="pkl.enabled">
          <Link className={styles.card} href="/pkl">
            PKL
          </Link>
        </IfCap>
        <IfCap name="portal.liaison">
          <Link className={styles.card} href="/penghubung">
            Buku penghubung
          </Link>
        </IfCap>
        {kaih && kaih !== 'off' && hasRole(...HABIT_SUMMARY_READERS) && (
          <Link className={styles.card} href="/kebiasaan">
            Jurnal 7 kebiasaan
          </Link>
        )}
        {hasRole(...RECAP_READERS) && mode === 'per_period' && (
          <Link className={styles.card} href="/jam-siswa">
            Jam siswa
          </Link>
        )}
        {hasRole(...RECAP_READERS) && (
          <Link className={styles.card} href="/rekap">
            Rekap kehadiran
          </Link>
        )}
        {hasRole(...STUDENT_READERS) && (
          <>
            <Link className={styles.card} href="/siswa">
              Data siswa
            </Link>
            <Link className={styles.card} href="/rombel">
              Rombel
            </Link>
          </>
        )}
        {hasRole(...SCHEDULE_PAGE_READERS) && (
          <Link className={styles.card} href="/jadwal">
            {mode === 'daily' ? 'Wali kelas dan jadwal' : 'Jadwal pelajaran'}
          </Link>
        )}
        {hasRole(...STUDENT_MANAGERS) && (dataSource === 'dapodik' || dataSource === 'emis') && (
          <Link className={styles.card} href="/import">
            Import {dataSource === 'emis' ? 'EMIS' : 'Dapodik'}
          </Link>
        )}
        {hasRole(...GATE_VIEWERS) && (
          <IfCap name="gate.enabled">
            <Link className={styles.card} href="/gerbang">
              Gerbang
            </Link>
          </IfCap>
        )}
        {hasRole(...VISITOR_VIEWERS) && (
          <IfCap name="gate.enabled">
            <IfCap name="gate.visitors">
              <Link className={styles.card} href="/tamu">
                Buku tamu
              </Link>
            </IfCap>
          </IfCap>
        )}
        {hasRole(...MEMORIZATION_WRITERS) && (
          <IfCap name="religious.memorization">
            <Link className={styles.card} href="/hafalan">
              Setoran hafalan
            </Link>
          </IfCap>
        )}
        {hasRole(...UKS_STAFF) && (
          <IfCap name="student.uks">
            <Link className={styles.card} href="/uks">
              UKS
            </Link>
          </IfCap>
        )}
        {hasRole(...POINT_RECORDERS) && (
          <IfCap name="student.points">
            <Link className={styles.card} href="/poin">
              Poin kesiswaan
            </Link>
          </IfCap>
        )}
        {hasRole(...FOLLOWUP_READERS) && (
          <IfCap name="student.points">
            <Link className={styles.card} href="/tindak-lanjut">
              Tugas tindak lanjut
            </Link>
          </IfCap>
        )}
        {hasRole(...EARLY_WARNING_READERS) && (
          <IfCap name="student.early_warning">
            <Link className={styles.card} href="/peringatan-dini">
              Peringatan dini
            </Link>
          </IfCap>
        )}
        {hasRole(...BK_READERS) && (
          <IfCap name="student.counseling">
            <Link className={styles.card} href="/bk">
              Catatan BK
            </Link>
          </IfCap>
        )}
        {hasRole(...TEACHER_CHECKIN) && (
          <IfCap name="teacher.attendance">
            <Link className={styles.card} href="/absen-guru">
              Absen guru
            </Link>
          </IfCap>
        )}
        {(hasRole(...TEACHER_CHECKIN) || hasRole(...TEACHER_LEAVE_DECIDING)) && (
          <IfCap name="teacher.attendance">
            <Link className={styles.card} href="/izin-guru">
              Izin guru
            </Link>
          </IfCap>
        )}
        {hasRole(...SUBSTITUTION_READING) && (
          <IfCap name="teacher.attendance">
            <Link className={styles.card} href="/pengganti">
              Guru pengganti
            </Link>
          </IfCap>
        )}
        {hasRole(...TEACHER_REPORT_READING) && (
          <IfCap name="teacher.attendance">
            <Link className={styles.card} href="/laporan-guru">
              Kehadiran guru
            </Link>
          </IfCap>
        )}
        <IfCap name="student.tppk">
          <TppkCards />
        </IfCap>
        <IfCap name="gate.pickup">
          <Link className={styles.card} href="/penjemputan">
            Penjemputan
          </Link>
        </IfCap>
        {hasRole(...MBG_READERS) && (
          <IfCap name="mbg.enabled">
            <MbgCard />
          </IfCap>
        )}
        {hasRole(...NOTIFY_VIEWERS) && (
          <Link className={styles.card} href="/notifikasi">
            Notifikasi WhatsApp
          </Link>
        )}
        {hasRole(...BILLING_READERS) && (
          <Link className={styles.card} href="/tagihan">
            Tagihan Absah
          </Link>
        )}
        {hasRole(...STUDENT_BILLING_READING) && (
          <IfCap name="student.billing">
            <Link className={styles.card} href="/tagihan-siswa">
              Tagihan siswa
            </Link>
          </IfCap>
        )}
        <IfCap name="exam.enabled">
          <Link className={styles.card} href="/ujian">
            {hasRole(...EXAM_VIEWING) ? 'Ujian' : 'Ruang ujian saya'}
          </Link>
        </IfCap>
        <Link className={styles.card} href="/pengaturan">
          Notifikasi di HP ini
        </Link>
        {isAdmin && (
          <Link className={styles.card} href="/setup">
            Pengaturan sekolah
          </Link>
        )}
      </nav>
      <div className={styles.actions}>
        {me.schools.length > 1 && (
          <Button variant="secondary" onClick={() => selectSchool(null)}>
            Ganti sekolah
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            void signOut().then(() => {
              selectSchool(null);
              router.replace('/masuk');
            })
          }
        >
          Keluar
        </Button>
      </div>
    </main>
  );
}
