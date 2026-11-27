'use client';

import { REQUIRED_SETUP_STEPS, SchoolSetupResponse, type SetupStep } from '@absah/contracts';
import { Chip, ErrorState, PageMain, SkeletonRows, Stepper, cx, messages, type ChipTone } from '@absah/ui';
import { CircleCheck, CircleDashed, CircleDot, SkipForward, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import { LEVEL_LABELS } from '@/lib/levels';
import { useWorkspace } from '@/lib/workspace';
import { describeCaps, GateStep, ImportStep, InviteStep, LevelStep, MbgStep, ProfileStep, type Caps, type StepProps } from './steps';

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

  const p = setup.profile;
  const done = setup.steps.filter((s) => s.status !== 'todo').length;
  const features = describeCaps(caps);
  return (
    <PageMain width="full">
      <header className="flex flex-col gap-1">
        <p className="m-0 text-small text-tinta-muted">{fill(t.stepOf, { n: index + 1, total, school: me.schools.find((s) => s.id === schoolId)?.name ?? '' })}</p>
        <p className="m-0 text-judul-kartu font-bold text-tinta">{t.pageTitle}</p>
      </header>
      <div className="card-surface overflow-x-auto rounded-kartu bg-kapur-raised px-5 py-4">
        <Stepper items={setup.steps.map((s) => ({ id: s.id, label: t.stepLabels[s.id], status: s.status }))} current={index} label={t.steps} skippedText={t.skipped} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
        <section className="card-surface min-w-0 rounded-kartu bg-kapur-raised p-5 lg:p-6">
          <View
            key={step.id}
            setup={setup}
            schoolId={schoolId}
            caps={caps}
            onCaps={setCaps}
            onDone={onDone}
            onBack={index > 0 ? () => setIndex(index - 1) : undefined}
          />
        </section>
            {step.id !== 'level' && (
            <AsideCard title={t.asideFeatures} aside={features.length > 0 ? String(features.length) : undefined}>
              {features.length > 0 ? (
                <ul className="m-0 grid list-none gap-x-6 gap-y-2 p-0 text-isi text-tinta sm:grid-cols-2 2xl:grid-cols-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CircleCheck aria-hidden strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-papan" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-isi text-tinta-muted">{t.asideFeaturesEmpty}</p>
              )}
              <p className="m-0 border-t border-hairline pt-3 text-small text-tinta-muted">{t.asideHelp}</p>
            </AsideCard>
            )}
        </div>
        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1" aria-label={t.pageTitle}>
          <AsideCard title={t.asideProfile}>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-isi">
              <Row term={t.rowName} value={p.name} />
              <Row term={t.rowNpsn} value={p.npsn} />
              <Row term={t.rowNsm} value={p.nsm} />
              <Row term={t.rowTimezone} value={TIMEZONES[p.timezone] ?? p.timezone} />
              <Row term={t.rowLevel} value={LEVEL_LABELS[p.level]} />
              <Row term={t.rowMadrasah} value={p.isMadrasah ? t.madrasahYes : t.madrasahNo} />
            </dl>
          </AsideCard>
          <AsideCard title={t.asideProgress} aside={fill(t.asideProgressCount, { done, total })}>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {setup.steps.map((s, i) => {
                const st = i === index ? NOW : STATUS[s.status];
                const reachable = i === index || s.status !== 'todo';
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!reachable}
                      aria-current={i === index ? 'step' : undefined}
                      onClick={() => setIndex(i)}
                      className={cx(
                        'flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-kontrol border-0 px-2 text-left text-isi text-tinta disabled:cursor-default',
                        i === index ? 'bg-papan-tipis font-bold' : 'bg-transparent hover:bg-ubin disabled:hover:bg-transparent',
                      )}
                    >
                      <span className="w-5 text-mini tabular-nums text-tinta-muted">{i + 1}</span>
                      <span className="flex-1">
                        {t.stepLabels[s.id]}
                        {REQUIRED_SETUP_STEPS.includes(s.id) && <span className="font-normal text-tinta-muted"> · {t.required}</span>}
                      </span>
                      <Chip tone={st.tone} icon={st.icon}>
                        {st.label}
                      </Chip>
                    </button>
                  </li>
                );
              })}
            </ol>
          </AsideCard>
        </aside>
      </div>
    </PageMain>
  );
}

const TIMEZONES: Record<string, string> = { 'Asia/Jakarta': t.wib, 'Asia/Makassar': t.wita, 'Asia/Jayapura': t.wit };

const STATUS: Record<'todo' | 'done' | 'skipped', { tone: ChipTone; icon: LucideIcon; label: string }> = {
  done: { tone: 'hadir', icon: CircleCheck, label: t.statusDone },
  skipped: { tone: 'neutral', icon: SkipForward, label: t.statusSkipped },
  todo: { tone: 'neutral', icon: CircleDashed, label: t.statusTodo },
};
const NOW = { tone: 'papan' as ChipTone, icon: CircleDot, label: t.statusNow };

function AsideCard({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="card-surface flex flex-col gap-3 rounded-kartu bg-kapur-raised p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-judul-kartu text-tinta">{title}</h2>
        {aside && <span className="text-small text-tinta-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({ term, value }: { term: string; value: string | null }) {
  return (
    <>
      <dt className="text-tinta-muted">{term}</dt>
      <dd className={cx('m-0 min-w-0 truncate font-semibold', !value && 'font-normal text-tinta-muted')}>{value || t.notSet}</dd>
    </>
  );
}
