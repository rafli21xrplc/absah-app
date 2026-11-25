'use client';

import { CheckDraw, fill, messages, StepList, type Step } from '@absah/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AUTH } from '@/lib/auth-config';
import { prepareHome } from '@/lib/home';

type Progress = 'account' | 'school' | 'today' | 'finished';
const ORDER: Progress[] = ['account', 'school', 'today', 'finished'];

/** "Berhasil masuk": a drawn tick, and steps that follow the real loading. Opens the home page as soon as it is ready (never later than the wait limit). */
export function SignedIn({ name, next }: { name?: string; next: string }) {
  const router = useRouter();
  const t = messages.signIn;
  const [progress, setProgress] = useState<Progress>('account');
  const [school, setSchool] = useState<string | undefined>();
  const left = useRef(false);

  useEffect(() => {
    const go = () => {
      if (left.current) return;
      left.current = true;
      router.replace(next);
    };
    const limit = setTimeout(go, AUTH.maxWaitAfterSignInMs);
    prepareHome((step, schoolName) => {
      if (step === 'school') {
        setSchool(schoolName);
        setProgress('school');
      } else setProgress('today');
    })
      .catch(() => undefined)
      .finally(() => {
        setProgress('finished');
        go();
      });
    return () => clearTimeout(limit);
  }, [router, next]);

  const at = ORDER.indexOf(progress);
  const status = (index: number): Step['status'] => (at > index ? 'done' : at === index ? 'running' : 'waiting');
  const steps: Step[] = [
    { id: 'account', label: t.stepAccount, status: at >= 1 ? 'done' : 'running' },
    { id: 'school', label: school ? fill(t.stepSchool, { school }) : t.stepSchoolPlain, status: status(1) },
    { id: 'today', label: t.stepToday, status: status(2) },
  ];

  return (
    <section aria-live="polite" className="flex flex-col items-start gap-5 rounded-lg border border-garis bg-kapur-raised px-7 py-8">
      <CheckDraw />
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 text-tinta">{t.doneTitle}</h1>
        <p className="m-0 text-body text-tinta-muted">{name ? fill(t.welcome, { name }) : t.welcomeNoName}</p>
      </div>
      <StepList steps={steps} label={t.stepsLabel} className="w-full" />
      <div className="flex w-full flex-col gap-2">
        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-garis">
          <div className="h-1.5 origin-left rounded-full bg-papan transition-transform duration-(--motion-masuk) ease-(--ease-masuk)" style={{ transform: `scaleX(${Math.min(at, 3) / 3})` }} />
        </div>
        <p className="m-0 text-small text-tinta-muted">{t.doneNote}</p>
      </div>
    </section>
  );
}
