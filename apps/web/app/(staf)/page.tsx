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
import { NOTIFY_VIEWERS } from '@/lib/notify';
import { SCHEDULE_PAGE_READERS } from '@/lib/schedule-access';
import { STUDENT_MANAGERS, STUDENT_READERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';
import styles from '../shell.module.css';

export default function StafHome() {
  const router = useRouter();
  const { me, schoolId, isAdmin, hasRole, selectSchool } = useWorkspace();
  const dataSource = useCapability('data.source');
  const mode = useCapability('attendance.mode');
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
        {hasRole(...STUDENT_MANAGERS) && dataSource === 'dapodik' && (
          <Link className={styles.card} href="/import">
            Import Dapodik
          </Link>
        )}
        {hasRole(...GATE_VIEWERS) && (
          <IfCap name="gate.enabled">
            <Link className={styles.card} href="/gerbang">
              Gerbang
            </Link>
          </IfCap>
        )}
        <IfCap name="gate.pickup">
          <span className={styles.card}>Penjemputan</span>
        </IfCap>
        <IfCap name="pkl.enabled">
          <span className={styles.card}>PKL</span>
        </IfCap>
        <IfCap name="mbg.enabled">
          <span className={styles.card}>MBG</span>
        </IfCap>
        {hasRole(...NOTIFY_VIEWERS) && (
          <Link className={styles.card} href="/notifikasi">
            Notifikasi WhatsApp
          </Link>
        )}
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
