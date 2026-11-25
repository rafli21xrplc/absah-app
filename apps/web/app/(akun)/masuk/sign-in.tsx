'use client';

import { AuthShell, messages, RoleTabs } from '@absah/ui';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { safeNext } from '@/lib/auth';
import { ParentFlow } from './parent-flow';
import { StaffForm } from './staff-form';

// The screen after signing in loads the school data (zod and the contracts, ~60 kB): it is fetched only once the sign-in worked,
// so the first load of /masuk stays light on a weak connection.
const SignedIn = dynamic(() => import('./signed-in').then((m) => m.SignedIn));

export type Way = 'staf' | 'ortu' | 'siswa';

const JALUR: Record<string, Way> = { staf: 'staf', 'orang-tua': 'ortu', siswa: 'siswa' };

export interface SignInProps {
  /** The tab that is open first (the old WhatsApp address opens "Orang tua"). ?jalur= overrides it. */
  start?: Way;
  /** Where to go when the address carries no ?lanjut=. */
  fallbackNext?: string;
}

/** One screen, three ways in. After signing in it shows what is being prepared and then opens the home page. */
export function SignIn({ start = 'staf', fallbackNext = '/' }: SignInProps) {
  const t = messages.signIn;
  const params = useSearchParams();
  const next = safeNext(params.get('lanjut'), fallbackNext);
  const [way, setWay] = useState<Way>(JALUR[params.get('jalur') ?? ''] ?? start);
  const [stage, setStage] = useState<'start' | 'code'>('start');
  const [done, setDone] = useState<{ name?: string } | null>(null);

  if (done) {
    return (
      <AuthShell>
        <SignedIn name={done.name} next={next} />
      </AuthShell>
    );
  }

  const change = (to: Way) => {
    setWay(to);
    setStage('start');
  };
  const flow = way === 'staf' ? <StaffForm onSignedIn={setDone} onStage={setStage} /> : way === 'ortu' ? <ParentFlow onSignedIn={setDone} onStage={setStage} /> : <Student />;

  // One tree for both stages: the flow keeps its state when the code step hides the heading and the tabs.
  const atStart = stage === 'start';
  return (
    <AuthShell footer={atStart ? messages.auth.footerNote : undefined}>
      <div className={atStart ? 'flex flex-col gap-1' : 'hidden'}>
        <h1 className="m-0 text-h1 text-tinta">{t.title}</h1>
        <p className="m-0 text-body text-tinta-muted">{t.lead}</p>
      </div>
      <RoleTabs
        label={t.roleLabel}
        tabsHidden={!atStart}
        value={way}
        onValueChange={change}
        tabs={[
          { key: 'staf', label: t.tabStaff },
          { key: 'ortu', label: t.tabParent },
          { key: 'siswa', label: t.tabStudent },
        ]}
      >
        {flow}
      </RoleTabs>
    </AuthShell>
  );
}

function Student() {
  const t = messages.signIn;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md border border-garis bg-kapur-raised p-4">
        <span className="text-body-strong font-bold text-tinta">{t.studentTitle}</span>
        <span className="text-body text-tinta-muted">{t.studentBody}</span>
      </div>
      <div className="rounded-md bg-papan-soft px-4 py-3 text-body text-tinta">{t.studentHelp}</div>
    </div>
  );
}
