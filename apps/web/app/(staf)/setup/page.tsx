'use client';

import { SchoolSetupResponse, type SetupStep } from '@absah/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import { api, ApiError } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import { GateStep, ImportStep, InviteStep, LevelStep, MbgStep, ProfileStep, type Caps, type StepProps } from './steps';
import styles from './setup.module.css';

const STEP_VIEWS: Record<SetupStep, ComponentType<StepProps>> = {
  profile: ProfileStep,
  level: LevelStep,
  mbg: MbgStep,
  import: ImportStep,
  gate: GateStep,
  invite: InviteStep,
};

/** Setup wizard for a new school's admin (PLT-12). Progress is stored on the server. */
export default function SetupPage() {
  const router = useRouter();
  const { me, schoolId, isAdmin, reload } = useWorkspace();
  const [setup, setSetup] = useState<SchoolSetupResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [caps, setCaps] = useState<Caps>(me.active?.capabilities ?? {});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !isAdmin) return;
    api('/school/setup', SchoolSetupResponse, { schoolId })
      .then((s) => {
        setSetup(s);
        const firstTodo = s.steps.findIndex((step) => step.status === 'todo');
        setIndex(firstTodo === -1 ? 0 : firstTodo);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat setup.'));
  }, [schoolId, isAdmin]);

  if (!schoolId || !isAdmin) {
    return (
      <main className={styles.main}>
        <p>Pengaturan sekolah hanya untuk admin sekolah.</p>
      </main>
    );
  }
  if (error) return <main className={styles.main}><p role="alert">{error}</p></main>;
  if (!setup) return <main className={styles.main}><p role="status">Memuat…</p></main>;

  const step = setup.steps[index];
  if (!step) return null;
  const View = STEP_VIEWS[step.id];
  const total = setup.steps.length;

  async function onDone(status: 'done' | 'skipped') {
    if (!schoolId || !step) return;
    const next = await api(`/school/setup/steps/${step.id}`, SchoolSetupResponse, { method: 'PUT', body: { status }, schoolId });
    setSetup(next);
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    await api('/school/setup/complete', SchoolSetupResponse, { method: 'POST', schoolId });
    reload();
    router.replace('/');
  }

  return (
    <main className={styles.main}>
      <p className={styles.progress}>
        Langkah {index + 1} dari {total} · {me.schools.find((s) => s.id === schoolId)?.name}
      </p>
      <div className={styles.bar} aria-hidden>
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <View
        key={step.id}
        setup={setup}
        schoolId={schoolId}
        caps={caps}
        onCaps={setCaps}
        onDone={onDone}
        onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      />
    </main>
  );
}
