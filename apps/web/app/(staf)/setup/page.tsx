'use client';

import { SchoolSetupResponse, type SetupStep } from '@absah/contracts';
import { ErrorState, PageMain, SkeletonRows, Stepper, messages } from '@absah/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import { api, ApiError } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import { GateStep, ImportStep, InviteStep, LevelStep, MbgStep, ProfileStep, type Caps, type StepProps } from './steps';

const STEP_VIEWS: Record<SetupStep, ComponentType<StepProps>> = {
  profile: ProfileStep,
  level: LevelStep,
  mbg: MbgStep,
  import: ImportStep,
  gate: GateStep,
  invite: InviteStep,
};

const t = messages.setup;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/** Setup wizard for a new school's admin (PLT-12). Progress is stored on the server. */
export default function SetupPage() {
  const router = useRouter();
  const { me, schoolId, isAdmin, reload } = useWorkspace();
  const [setup, setSetup] = useState<SchoolSetupResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [caps, setCaps] = useState<Caps>(me.active?.capabilities ?? {});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!schoolId || !isAdmin) return;
    api('/school/setup', SchoolSetupResponse, { schoolId })
      .then((s) => {
        setSetup(s);
        const firstTodo = s.steps.findIndex((step) => step.status === 'todo');
        setIndex(firstTodo === -1 ? 0 : firstTodo);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t.loadFailedBody));
  }, [schoolId, isAdmin, attempt]);

  if (!schoolId || !isAdmin) {
    return (
      <PageMain>
        <p className="m-0 text-body">{t.adminOnly}</p>
      </PageMain>
    );
  }
  if (error) {
    return (
      <PageMain>
        <ErrorState title={t.loadFailed} onRetry={() => { setError(null); setAttempt((n) => n + 1); }}>
          {error}
        </ErrorState>
      </PageMain>
    );
  }
  if (!setup) {
    return (
      <PageMain>
        <SkeletonRows count={4} />
      </PageMain>
    );
  }

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
    <PageMain width="md">
      <header className="flex flex-col gap-3">
        <p className="m-0 text-small text-tinta-muted">{fill(t.stepOf, { n: index + 1, total, school: me.schools.find((s) => s.id === schoolId)?.name ?? '' })}</p>
        <Stepper items={setup.steps.map((s) => ({ id: s.id, label: t.stepLabels[s.id], status: s.status }))} current={index} label={t.steps} skippedText={t.skipped} />
      </header>
      <View
        key={step.id}
        setup={setup}
        schoolId={schoolId}
        caps={caps}
        onCaps={setCaps}
        onDone={onDone}
        onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      />
    </PageMain>
  );
}
