'use client';

import type { KioskUnlistedPickup } from '@absah/contracts';
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
      if (!v) return finish({ color: FEEDBACK.rejected.color, label: 'Data hari ini belum terunduh', name: null, detail: 'Sambungkan kios ke internet sebentar.' }, 'error');
      if (v.kind === 'rejected') return finish({ color: FEEDBACK.rejected.color, label: FEEDBACK.rejected.label, name: null, detail: REJECT_HINTS[v.reason] }, 'error');
      if (v.kind === 'already_out') return finish({ color: FEEDBACK.duplicate.color, label: 'Sudah pulang', name: v.firstName, detail: 'Sudah dijemput hari ini.' }, 'warn');
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
            finish({ color: FEEDBACK.on_time.color, label: 'Boleh pulang', name: held.v.firstName, detail: `Bersama ${now.pickupName}, disetujui ${now.decidedVia === 'guardian' ? 'orang tua' : 'wali kelas'}.` }, 'ok');
          } else if (now.status !== 'held') {
            finish({ color: FEEDBACK.rejected.color, label: 'Tidak diizinkan', name: held.v.firstName, detail: 'Anak tetap di sekolah. Hubungi wali kelas.' }, 'error');
          }
        })
        .catch(() => undefined); // offline for a moment: keep asking
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [held, actions, finish]);

  const status = state.online ? 'Tersambung' : 'Offline';
  return (
    <main className={styles.kiosk}>
      <header className={styles.bar}>
        <span>
          {state.pairing.schoolName} · Pulang
        </span>
        <span data-testid="kiosk-status">
          {status}
          {state.queueSize > 0 ? ` · antrean ${state.queueSize}` : ''}
        </span>
      </header>
      <button type="button" className={styles.guestButton} onClick={onClose}>
        Mode datang
      </button>
      {step.step === 'idle' && (
        <>
          <section className={styles.stage} aria-live="assertive" data-testid="kiosk-feedback">
            <div className={styles.answer}>
              <p className={styles.idle}>Pulang: tunjukkan kartu siswa</p>
              <p className={styles.hint}>Penjemput dipilih dari foto setelah kartu terbaca.</p>
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
        <section className={styles.screen} aria-label="Pilih penjemput">
          <h1 className={styles.title}>
            {step.v.firstName} · {step.v.className}
          </h1>
          {step.v.guardians.length === 0 ? <p className={styles.hint}>Belum ada penjemput resmi yang disetujui.</p> : <p className={styles.hint}>Pilih penjemput yang hadir:</p>}
          <div className={styles.pickGrid}>
            {step.v.guardians.map((g) => (
              <button key={g.id} type="button" className={styles.pickCard} onClick={() => setStep({ step: 'confirm', v: step.v, guardian: g })}>
                <StoredPhoto id={g.id} alt={`Foto ${g.name}`} photoOf={actions.photoOf} />
                <span>{g.name}</span>
                <small>{RELATION_LABELS[g.relation]}</small>
              </button>
            ))}
          </div>
          <button type="button" className={styles.secondary} onClick={() => setStep({ step: 'unlisted', v: step.v })}>
            Penjemput tidak terdaftar
          </button>
          <button type="button" className={styles.secondary} onClick={() => setStep({ step: 'idle' })}>
            Batal
          </button>
        </section>
      )}
      {step.step === 'confirm' && (
        <section className={styles.screen} aria-label="Konfirmasi penjemput">
          <div className={styles.pair}>
            <StoredPhoto id={step.guardian.id} alt={`Foto ${step.guardian.name}`} photoOf={actions.photoOf} />
            <h1 className={styles.title}>
              {step.v.firstName} pulang bersama {step.guardian.name}?
            </h1>
            <button
              type="button"
              className={styles.primary}
              onClick={() =>
                void actions.confirmCheckout(step.v, step.guardian.id).then(() => finish({ color: FEEDBACK.on_time.color, label: 'Hati-hati di jalan', name: step.v.firstName, detail: `Pulang bersama ${step.guardian.name}.` }, 'ok'))
              }
            >
              Konfirmasi
            </button>
            <button type="button" className={styles.secondary} onClick={() => setStep({ step: 'pick', v: step.v })}>
              Kembali
            </button>
          </div>
        </section>
      )}
      {step.step === 'unlisted' && <UnlistedForm v={step.v} hold={actions.holdUnlisted} onHeld={(h) => setStep({ step: 'waiting', v: step.v, held: h })} onBack={() => setStep({ step: 'pick', v: step.v })} />}
      {step.step === 'waiting' && (
        <section className={styles.stage} aria-live="polite" data-testid="kiosk-feedback">
          <div className={styles.answer}>
            <p className={styles.label}>Menunggu persetujuan</p>
            <p className={styles.name}>{step.v.firstName}</p>
            <p className={styles.detail}>{step.held.pickupName} belum terdaftar. Orang tua sudah dikirimi pesan; wali kelas juga bisa mengizinkan. Anak tetap di sekolah sampai ada persetujuan.</p>
            <button type="button" className={styles.secondary} onClick={() => setStep({ step: 'idle' })}>
              Tutup (permintaan tetap berjalan)
            </button>
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
    if (!name.trim()) return setError('Tulis nama penjemput.');
    if (!photo) return setError('Ambil foto penjemput.');
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
    <section className={styles.screen}>
      <form className={styles.pair} onSubmit={(e) => void submit(e)}>
        <h1 className={styles.title}>Penjemput tidak terdaftar untuk {v.firstName}</h1>
        <label className={styles.field}>
          Nama penjemput
          <input
            value={name}
            onChange={(e) => {
              attempt.current = newAttempt();
              setName(e.target.value);
            }}
            maxLength={100}
            autoComplete="off"
          />
        </label>
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
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Mengirim…' : 'Minta persetujuan'}
        </button>
        <button type="button" className={styles.secondary} onClick={onBack} disabled={busy}>
          Kembali
        </button>
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
  return url ? <img src={url} alt={alt} className={styles.pickPhoto} /> : <span className={styles.pickPhoto} role="img" aria-label={`${alt} belum terunduh`} />;
}
