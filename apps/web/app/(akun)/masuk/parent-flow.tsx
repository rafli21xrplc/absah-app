'use client';

import { Banner, Button, CodeInput, CountdownRing, Field, fill, Input, messages, useShake } from '@absah/ui';
import { useState, type FormEvent } from 'react';
import { AuthError, sendPhoneOtp, verifyPhoneOtp } from '@/lib/auth';
import { AUTH } from '@/lib/auth-config';
import { maskNumber, parentNumber } from '@/lib/phone';
import { useOnline } from '@/lib/online';

export interface ParentFlowProps {
  onSignedIn: (who: { name?: string }) => void;
  onStage: (stage: 'start' | 'code') => void;
}

/** Orang tua: number, then the six-digit WhatsApp code. No password. The answer is the same whether or not the number has an account. */
export function ParentFlow({ onSignedIn, onStage }: ParentFlowProps) {
  const t = messages.signIn;
  const online = useOnline();
  const [typed, setTyped] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A new key restarts the resend countdown.
  const [round, setRound] = useState(0);
  const [canResend, setCanResend] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const number = parentNumber(typed);
    if (!/^\+628\d{7,12}$/.test(number)) {
      setError(t.parentNumberWrong);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendPhoneOtp(number);
      setPhone(number);
      setRound((n) => n + 1);
      setCanResend(false);
      onStage('code');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : t.unknownBody);
    } finally {
      setBusy(false);
    }
  }

  if (phone) {
    return (
      <CodeStep
        phone={phone}
        round={round}
        canResend={canResend}
        onCountdownDone={() => setCanResend(true)}
        onResend={async () => {
          await sendPhoneOtp(phone);
          setRound((n) => n + 1);
          setCanResend(false);
        }}
        onChangeNumber={() => {
          setPhone(null);
          setError(null);
          onStage('start');
        }}
        onSignedIn={onSignedIn}
      />
    );
  }

  return (
    <>
      {!online && (
        <Banner kind="offline" title={t.offlineTitle}>
          {t.offlineBody}
        </Banner>
      )}
      <form onSubmit={(e) => void send(e)} noValidate className="flex flex-col gap-4">
        <Field label={t.parentLabel} error={error ?? undefined}>
          <span className="flex gap-2">
            <span className="flex min-h-12 shrink-0 items-center rounded-md border border-garis-kuat bg-kapur px-3 text-body-strong text-tinta">{t.parentPrefix}</span>
            <Input
              type="tel"
              name="phone"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder={t.parentPlaceholder}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              className="min-w-0 flex-1"
            />
          </span>
        </Field>
        <div className="rounded-md bg-papan-soft px-4 py-3 text-body text-tinta">
          {t.parentInfoBefore}
          <b>{t.parentInfoBold}</b>
          {t.parentInfoAfter}
        </div>
        <Button type="submit" size="52" loading={busy} disabled={!busy && !online} className="w-full">
          {online ? t.parentSend : t.submitOffline}
        </Button>
      </form>
    </>
  );
}

function CodeStep({
  phone,
  round,
  canResend,
  onCountdownDone,
  onResend,
  onChangeNumber,
  onSignedIn,
}: {
  phone: string;
  round: number;
  canResend: boolean;
  onCountdownDone: () => void;
  onResend: () => Promise<void>;
  onChangeNumber: () => void;
  onSignedIn: ParentFlowProps['onSignedIn'];
}) {
  const t = messages.signIn;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const shake = useShake(wrongCount);

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneOtp(phone, value);
      onSignedIn({});
    } catch (err) {
      setError(err instanceof AuthError && err.kind === 'locked' ? err.message : t.codeWrong);
      setWrongCount((n) => n + 1);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 text-tinta">{t.codeTitle}</h1>
        <p className="m-0 text-body text-tinta-muted">{fill(t.codeLead, { masked: maskNumber(phone) })}</p>
      </div>
      <CodeInput label={t.codeLabel} value={code} onChange={setCode} onComplete={(v) => void verify(v)} invalid={Boolean(error)} disabled={busy} autoFocus aria-describedby="code-note" boxesClassName={shake} />
      <p id="code-note" role={error ? 'alert' : undefined} className={error ? 'm-0 text-small font-semibold text-alpa' : 'm-0 text-small text-tinta-muted'}>
        {error ?? t.codeAuto}
      </p>
      {canResend ? (
        <Button variant="secondary" size="48" onClick={() => void onResend().catch(() => undefined)} className="self-start">
          {t.resend}
        </Button>
      ) : (
        <p className="m-0 flex items-center gap-2 text-body text-tinta-muted">
          {t.resendIn} <CountdownRing key={round} seconds={AUTH.resendSeconds} onDone={onCountdownDone} />
        </p>
      )}
      <Button variant="ghost" size="48" onClick={onChangeNumber} className="self-start">
        {t.changeNumber}
      </Button>
      <Banner kind="info" title={t.codeWarningTitle}>
        {t.codeWarning}
      </Banner>
    </div>
  );
}
