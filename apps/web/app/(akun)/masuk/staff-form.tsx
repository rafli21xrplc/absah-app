'use client';

import { Banner, Button, CodeInput, Field, fill, Input, messages, PasswordField, useShake } from '@absah/ui';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthError, signInWithPassword, verifyTotp, type SignedIn } from '@/lib/auth';
import { AUTH } from '@/lib/auth-config';
import { useOnline } from '@/lib/online';

type Problem = { kind: 'invalid'; attemptsLeft?: number } | { kind: 'locked'; unlockAt: Date } | { kind: 'unreachable' } | { kind: 'unknown' };

const clock = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
/** A complete address has something before the @ and a dot after it. */
const looksLikeEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

function toProblem(err: unknown): Problem {
  if (!(err instanceof AuthError)) return { kind: 'unknown' };
  if (err.kind === 'locked' && err.detail.unlockAt) return { kind: 'locked', unlockAt: err.detail.unlockAt };
  if (err.kind === 'invalid') return { kind: 'invalid', attemptsLeft: err.detail.attemptsLeft };
  return err.kind === 'offline' || err.kind === 'unreachable' ? { kind: 'unreachable' } : { kind: 'unknown' };
}

/** The answer of the server as one banner. Focus moves to it, so a screen reader hears it at once. */
function ProblemBanner({ problem }: { problem: Problem }) {
  const t = messages.signIn;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [problem]);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {problem.kind === 'invalid' && (
        <Banner kind="error" title={t.invalidTitle}>
          {t.invalidBody}
          {problem.attemptsLeft !== undefined && ` ${fill(t.attemptsLeft, { left: problem.attemptsLeft, total: AUTH.maxAttempts })}`}
        </Banner>
      )}
      {problem.kind === 'locked' && (
        <Banner kind="error" icon={Lock} title={t.lockedTitle}>
          {fill(AUTH.passwordReset ? t.lockedBodyReset : t.lockedBody, { time: clock(problem.unlockAt) })}
        </Banner>
      )}
      {problem.kind === 'unreachable' && (
        <Banner kind="warning" title={t.unreachableTitle}>
          {t.unreachableBody}
        </Banner>
      )}
      {problem.kind === 'unknown' && (
        <Banner kind="error" title={t.unknownTitle}>
          {t.unknownBody}
        </Banner>
      )}
    </div>
  );
}

export interface StaffFormProps {
  onSignedIn: (who: { name?: string }) => void;
  /** Tells the page when the two-step code replaces the form (the tabs go away). */
  onStage: (stage: 'start' | 'code') => void;
}

/** Guru dan staf: email and password, then the authenticator code for admin and operator. */
export function StaffForm({ onSignedIn, onStage }: StaffFormProps) {
  const t = messages.signIn;
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [shakes, setShakes] = useState(0);
  const [step, setStep] = useState<'password' | 'code'>('password');
  const shake = useShake(shakes);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // A lock opens by itself at the time the server named: the form works again without a reload.
  const unlockAt = problem?.kind === 'locked' ? problem.unlockAt : null;
  useEffect(() => {
    if (!unlockAt) return;
    const id = setTimeout(() => setProblem(null), Math.max(0, unlockAt.getTime() - Date.now()));
    return () => clearTimeout(id);
  }, [unlockAt]);

  const wrong = (next: Problem) => {
    setProblem(next);
    setShakes((n) => n + 1);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || unlockAt) return;
    const trimmed = email.trim();
    const next = {
      email: !trimmed ? t.emailEmpty : !looksLikeEmail(trimmed) ? t.emailIncomplete : undefined,
      password: password ? undefined : t.passwordEmpty,
    };
    setErrors(next);
    if (next.email || next.password) {
      setShakes((n) => n + 1);
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result: SignedIn = await signInWithPassword(trimmed, password, { remember });
      if (result.next === 'two_factor') {
        setStep('code');
        onStage('code');
      } else onSignedIn({ name: result.name });
    } catch (err) {
      wrong(toProblem(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code') return <TotpStep onSignedIn={onSignedIn} onBack={() => (setStep('password'), onStage('start'))} />;

  const label = busy ? t.submitBusy : !online ? t.submitOffline : unlockAt ? fill(t.submitLocked, { time: clock(unlockAt) }) : t.submit;
  return (
    <div className={shake}>
      {!online && (
        <Banner kind="offline" title={t.offlineTitle} className="mb-5">
          {t.offlineBody}
        </Banner>
      )}
      {problem && <ProblemBanner problem={problem} />}
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-5 flex flex-col gap-4 first:mt-0">
        <Field label={t.email} error={errors.email}>
          <Input
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            placeholder={t.emailPlaceholder}
            value={email}
            readOnly={busy}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((x) => ({ ...x, email: undefined }));
            }}
          />
        </Field>
        <PasswordField
          ref={passwordRef}
          label={t.password}
          name="password"
          autoComplete="current-password"
          value={password}
          readOnly={busy}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((x) => ({ ...x, password: undefined }));
          }}
        />
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 size-5 shrink-0 cursor-pointer accent-papan" />
          <span className="flex flex-col">
            <span className="text-body font-medium text-tinta">{t.remember}</span>
            <span className="text-small text-tinta-muted">{t.rememberHint}</span>
          </span>
        </label>
        <Button type="submit" size="52" loading={busy} disabled={!busy && (!online || Boolean(unlockAt))} className="w-full">
          {label}
        </Button>
      </form>
      {AUTH.passwordReset && (
        <p className="m-0 mt-4 text-center text-body-strong font-bold">
          <Link href="/lupa">{t.forgot}</Link>
        </p>
      )}
    </div>
  );
}

/** Admin and operator: the six digits from the authenticator app. It sends itself on the sixth digit. */
function TotpStep({ onSignedIn, onBack }: { onSignedIn: StaffFormProps['onSignedIn']; onBack: () => void }) {
  const t = messages.signIn;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const shake = useShake(wrongCount);

  async function send(value: string) {
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(value);
      onSignedIn({});
    } catch (err) {
      setError(err instanceof AuthError && err.kind === 'locked' ? err.message : t.totpWrong);
      setWrongCount((n) => n + 1);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 text-tinta">{t.totpTitle}</h1>
        <p className="m-0 text-body text-tinta-muted">{t.totpLead}</p>
      </div>
      <CodeInput label={t.totpLabel} value={code} onChange={setCode} onComplete={(v) => void send(v)} invalid={Boolean(error)} disabled={busy} autoFocus aria-describedby="totp-note" boxesClassName={shake} />
      <p id="totp-note" role={error ? 'alert' : undefined} className={error ? 'm-0 text-small font-semibold text-alpa' : 'm-0 text-small text-tinta-muted'}>
        {error ?? t.totpAuto}
      </p>
      <Button variant="ghost" size="48" onClick={onBack} className="self-start">
        {t.totpBack}
      </Button>
    </div>
  );
}
