'use client';

import type { KioskUnlistedPickup } from '@absah/contracts';
import { Button, Field, Input, messages } from '@absah/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import styles from '@/app/page.module.css';
import { beep } from '@/lib/beep';
import { unlistedError, type CheckoutVerdict, type PickupGuardianOption } from '@/lib/checkout';
import { FEEDBACK, REJECT_HINTS } from '@/lib/feedback';
import type { KioskState } from '@/lib/use-kiosk';
import { newAttempt, type Attempt } from '@/lib/visitors';
import { wedgeReader } from '@/lib/wedge';
import { Camera } from './camera';
import { PhotoCapture } from './photo-capture';

const t = messages.pickup;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

type Ready = Extract<KioskState, { phase: 'ready' }>;
type Pick = Extract<CheckoutVerdict, { kind: 'pick' }>;
type Done = { color: string; label: string; name: string | null; detail: string };

const SHOW_MS = 3_000;
const SAME_CODE_MS = 5_000;
const POLL_MS = 3_000;

const RELATION_LABELS: Record<PickupGuardianOption['relation'], string> = {
  ayah: 'Ayah',
  ibu: 'Ibu',
  kakek: 'Kakek',
  nenek: 'Nenek',
  kakak: 'Kakak',
  paman: 'Paman',
  bibi: 'Bibi',
  sopir: 'Sopir',
  lainnya: 'Lainnya',
};

type Step =
  | { step: 'idle' }
  | { step: 'pick'; v: Pick }
  | { step: 'confirm'; v: Pick; guardian: PickupGuardianOption }
  | { step: 'unlisted'; v: Pick }
  | { step: 'waiting'; v: Pick; held: KioskUnlistedPickup }
  | { step: 'done'; done: Done };

export interface CheckoutActions {
  checkoutScan: (text: string) => Promise<CheckoutVerdict | null>;
  confirmCheckout: (v: Pick, guardianId: string) => Promise<void>;
  markOut: (schoolDate: string, cardId: string) => Promise<void>;
  holdUnlisted: (input: { token: string; scannedAt: string; name: string; photo: Blob }, attempt: Attempt) => Promise<KioskUnlistedPickup>;
  pollUnlisted: (id: string) => Promise<KioskUnlistedPickup>;
  photoOf: (id: string) => Promise<Blob | null>;
}

/**
 * Pulang (GRB-10): scan the card, pick the penjemput among the photos, confirm. Works offline from
 * the morning list; an unlisted penjemput needs the network and waits for a parent or the wali kelas.
 */
export function CheckoutScreen({ state, actions, onClose }: { state: Ready; actions: CheckoutActions; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ step: 'idle' });
  const last = useRef({ text: '', at: 0 });

  const finish = useCallback((done: Done, sound: 'ok' | 'warn' | 'error') => {
    beep(sound);
    setStep({ step: 'done', done });
  }, []);

  useEffect(() => {
    if (step.step !== 'done') return;
    const timer = setTimeout(() => setStep({ step: 'idle' }), SHOW_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const onCode = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (text === last.current.text && now - last.current.at < SAME_CODE_MS) return;
      last.current = { text, at: now };
      const v = await actions.checkoutScan(text);
      if (!v) return finish({ color: FEEDBACK.rejected.color, label: t.notDownloaded, name: null, detail: t.connectBriefly }, 'error');
      if (v.kind === 'rejected') return finish({ color: FEEDBACK.rejected.color, label: FEEDBACK.rejected.label, name: null, detail: REJECT_HINTS[v.reason] }, 'error');
      if (v.kind === 'already_out') return finish({ color: FEEDBACK.duplicate.color, label: t.alreadyOut, name: v.firstName, detail: t.alreadyOutDetail }, 'warn');
      beep('ok');
      setStep({ step: 'pick', v });
    },
    [actions, finish],
  );

  const scanning = step.step === 'idle';
  useEffect(() => {
    if (!scanning) return;
    const read = wedgeReader((code) => void onCode(code));
    const onKey = (e: KeyboardEvent) => read(e.key, e.timeStamp);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCode, scanning]);

  // While held: ask the server until a parent or the wali kelas decided.
  const held = step.step === 'waiting' ? step : null;
  useEffect(() => {
    if (!held) return;
    const timer = setInterval(() => {
      void actions
        .pollUnlisted(held.held.id)
        .then(async (now) => {
          if (now.status === 'released') {
            await actions.markOut(held.v.schoolDate, held.v.cardId);
            finish({ color: FEEDBACK.on_time.color, label: t.mayLeave, name: held.v.firstName, detail: fill(t.mayLeaveDetail, { name: now.pickupName, by: now.decidedVia === 'guardian' ? t.byGuardian : t.byTeacher }) }, 'ok');
          } else if (now.status !== 'held') {
            finish({ color: FEEDBACK.rejected.color, label: t.denied, name: held.v.firstName, detail: t.deniedDetail }, 'error');
          }
        })
        .catch(() => undefined); // offline for a moment: keep asking
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [held, actions, finish]);

  const status = state.online ? t.online : t.offline;
  return (
    <main className={styles.kiosk}>
      <header className={styles.bar}>
        <span>
          {state.pairing.schoolName} · Pulang
        </span>
        <span data-testid="kiosk-status">
          {status}
          {state.queueSize > 0 ? ` · ${fill(t.queue, { n: state.queueSize })}` : ''}
        </span>
      </header>
      <button type="button" className={styles.guestButton} onClick={onClose}>
        {t.modeArrive}
      </button>
      {step.step === 'idle' && (
        <>
          <section className={styles.stage} aria-live="assertive" data-testid="kiosk-feedback">
            <div className={styles.answer}>
              <p className={styles.idle}>{t.scanHint}</p>
              <p className={styles.hint}>{t.scanDetail}</p>
            </div>
          </section>
          <Camera onCode={(text) => void onCode(text)} className={styles.camera} />
        </>
      )}
      {step.step === 'done' && (
        <section className={styles.stage} style={{ background: step.done.color }} aria-live="assertive" data-testid="kiosk-feedback">
          <div className={styles.answer}>
            <p className={styles.label}>{step.done.label}</p>
            {step.done.name ? <p className={styles.name}>{step.done.name}</p> : null}
            <p className={styles.detail}>{step.done.detail}</p>
          </div>
        </section>
      )}
      {step.step === 'pick' && (
        <section className="flex flex-col items-center gap-6 p-6 text-center" aria-label={t.pickTitle}>
          <h1 className="m-0 text-display">
            {step.v.firstName} · {step.v.className}
          </h1>
          <p className="m-0 text-h3 text-tinta-muted">{step.v.guardians.length === 0 ? t.noGuardians : t.pickWho}</p>
          <div className="grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(11rem,13rem))] justify-center gap-4">
            {step.v.guardians.map((g) => (
              <button
                key={g.id}
                type="button"
                className="flex min-h-16 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-papan bg-kapur-raised p-3 text-h3 text-tinta"
                onClick={() => setStep({ step: 'confirm', v: step.v, guardian: g })}
              >
                <StoredPhoto id={g.id} alt={fill(t.photoOf, { name: g.name })} photoOf={actions.photoOf} />
                <span className="text-h2">{g.name}</span>
                <small className="text-body text-tinta-muted">{RELATION_LABELS[g.relation]}</small>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="64" variant="secondary" onClick={() => setStep({ step: 'unlisted', v: step.v })}>
              {t.unlistedButton}
            </Button>
            <Button size="64" variant="ghost" onClick={() => setStep({ step: 'idle' })}>
              {t.cancel}
            </Button>
          </div>
        </section>
      )}
      {step.step === 'confirm' && (
        <section className="flex flex-col items-center gap-6 p-6 text-center" aria-label={t.confirmTitle}>
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            <StoredPhoto id={step.guardian.id} alt={fill(t.photoOf, { name: step.guardian.name })} photoOf={actions.photoOf} />
            <h1 className="m-0 text-h1">{fill(t.confirmQuestion, { child: step.v.firstName, guardian: step.guardian.name })}</h1>
            <Button
              size="64"
              className="w-full"
              onClick={() =>
                void actions.confirmCheckout(step.v, step.guardian.id).then(() => finish({ color: FEEDBACK.on_time.color, label: t.safeTrip, name: step.v.firstName, detail: fill(t.leftWith, { guardian: step.guardian.name }) }, 'ok'))
              }
            >
              {t.confirm}
            </Button>
            <Button size="64" variant="secondary" className="w-full" onClick={() => setStep({ step: 'pick', v: step.v })}>
              {t.back}
            </Button>
          </div>
        </section>
      )}
      {step.step === 'unlisted' && <UnlistedForm v={step.v} hold={actions.holdUnlisted} onHeld={(h) => setStep({ step: 'waiting', v: step.v, held: h })} onBack={() => setStep({ step: 'pick', v: step.v })} />}
      {step.step === 'waiting' && (
        <section className={styles.stage} aria-live="polite" data-testid="kiosk-feedback">
          <div className={styles.answer}>
            <p className={styles.label}>{t.waiting}</p>
            <p className={styles.name}>{step.v.firstName}</p>
            <p className={styles.detail}>{fill(t.waitingDetail, { name: step.held.pickupName })}</p>
            <Button size="64" variant="secondary" className="mt-4" onClick={() => setStep({ step: 'idle' })}>
              {t.closeWaiting}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

function UnlistedForm({ v, hold, onHeld, onBack }: { v: Pick; hold: CheckoutActions['holdUnlisted']; onHeld: (h: KioskUnlistedPickup) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<Attempt>(newAttempt());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError(t.needName);
    if (!photo) return setError(t.needPhoto);
    setBusy(true);
    setError(null);
    try {
      onHeld(await hold({ token: v.token, scannedAt: v.scannedAt, name, photo }, attempt.current));
    } catch (err) {
      setError(unlistedError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex justify-center p-6">
      <form className="flex w-full max-w-md flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <h1 className="m-0 text-h1">{fill(t.unlistedTitle, { child: v.firstName })}</h1>
        <Field label={t.guardianName}>
          <Input
            value={name}
            onChange={(e) => {
              attempt.current = newAttempt();
              setName(e.target.value);
            }}
            maxLength={100}
            autoComplete="off"
          />
        </Field>
        <PhotoCapture
          photo={photo}
          onPhoto={(p) => {
            attempt.current = newAttempt();
            setPhoto(p);
          }}
          who="penjemput"
          optional={false}
        />
        {error ? (
          <p role="alert" className="m-0 text-body text-alpa">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="64" loading={busy}>
          {t.askApproval}
        </Button>
        <Button variant="secondary" size="64" onClick={onBack} disabled={busy}>
          {t.back}
        </Button>
      </form>
    </section>
  );
}

/** A penjemput photo from the device (downloaded in the morning), shown from a local blob: URL. */
function StoredPhoto({ id, alt, photoOf }: { id: string; alt: string; photoOf: (id: string) => Promise<Blob | null> }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let live = true;
    void photoOf(id).then((b) => live && setBlob(b));
    return () => {
      live = false;
    };
  }, [id, photoOf]);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing to optimise
  return url ? <img src={url} alt={alt} className="aspect-[3/4] w-full rounded-lg bg-garis object-cover" /> : <span className="block aspect-[3/4] w-full rounded-lg bg-garis" role="img" aria-label={fill(t.photoMissing, { alt })} />;
}
