'use client';

import { CAPABILITY_KEYS, CAPABILITIES, presetCapabilities, type Level } from '@absah/capabilities';
import {
  InvitationResponse,
  SchoolCapabilitiesResponse,
  SchoolProfileResponse,
  STAFF_ROLES,
  type SchoolSetupResponse,
  type StaffRole,
} from '@absah/contracts';
import { Button } from '@absah/ui';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { CAPABILITY_LABELS, CAPABILITY_VALUE_LABELS } from '@/lib/capability-labels';
import { LEVEL_LABELS, LEVEL_OPTIONS } from '@/lib/levels';
import { ROLE_LABELS } from '@/lib/roles';
import forms from '../../forms.module.css';
import styles from './setup.module.css';
import { toE164 } from '@/lib/phone';

export type Caps = Record<string, unknown>;

export interface StepProps {
  setup: SchoolSetupResponse;
  schoolId: string;
  caps: Caps;
  onCaps: (caps: Caps) => void;
  onDone: (status: 'done' | 'skipped') => Promise<void>;
  onBack?: () => void;
}

/** Submit wrapper: busy state, Indonesian error text, field errors. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function run(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action(new FormData(event.currentTarget));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const message =
    error instanceof ApiError
      ? error.code === 'VALIDATION_FAILED' && Array.isArray(error.body.details)
        ? 'Periksa lagi isian yang ditandai.'
        : error.message
      : error
        ? 'Tidak bisa terhubung. Periksa internet lalu coba lagi.'
        : null;
  return { busy, error, message, run };
}

function Shell(props: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  busy: boolean;
  message: string | null;
  submitLabel?: string;
  onBack?: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  extra?: ReactNode;
}) {
  return (
    <form className={forms.form} onSubmit={props.onSubmit}>
      <h1 className={styles.title}>{props.title}</h1>
      {props.hint && <p className={forms.hint}>{props.hint}</p>}
      {props.children}
      {props.message && (
        <p className={forms.error} role="alert">
          {props.message}
        </p>
      )}
      <div className={styles.nav}>
        {props.onBack ? (
          <Button variant="secondary" onClick={props.onBack}>
            Kembali
          </Button>
        ) : (
          <span />
        )}
        <span style={{ display: 'flex', gap: 8 }}>
          {props.extra}
          <Button type="submit" disabled={props.busy}>
            {props.submitLabel ?? 'Simpan dan lanjut'}
          </Button>
        </span>
      </div>
    </form>
  );
}

const capsOf = (settings: SchoolCapabilitiesResponse): Caps =>
  Object.fromEntries(settings.items.map((i) => [i.key, i.effective]));

async function setCapability(schoolId: string, key: string, value: boolean | null): Promise<Caps> {
  const settings = await api('/school/capabilities', SchoolCapabilitiesResponse, {
    method: 'PUT',
    body: { values: { [key]: value } },
    schoolId,
    idempotencyKey: newIdempotencyKey(),
  });
  return capsOf(settings);
}

/** 1. Name, NPSN or NSM, time zone. */
export function ProfileStep({ setup, schoolId, onCaps, onDone, onBack }: StepProps) {
  const { busy, error, message, run } = useSubmit();
  const p = setup.profile;
  const submit = (e: FormEvent<HTMLFormElement>) =>
    void run(e, async (d) => {
      const text = (k: string) => String(d.get(k) ?? '').trim();
      const res = await api('/school/profile', SchoolProfileResponse, {
        method: 'PATCH',
        body: { name: text('name'), npsn: text('npsn') || null, nsm: text('nsm') || null, timezone: text('timezone') },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      onCaps(res.capabilities);
      await onDone('done');
    });
  return (
    <Shell title="Profil sekolah" busy={busy} message={message} onBack={onBack} onSubmit={submit}>
      <label className={forms.field}>
        <span className={forms.label}>Nama sekolah</span>
        <input className={forms.input} name="name" defaultValue={p.name} required minLength={3} maxLength={120} />
        {fieldError(error, 'name') && <span className={forms.error}>{fieldError(error, 'name')}</span>}
      </label>
      <label className={forms.field}>
        <span className={forms.label}>NPSN</span>
        <input className={forms.input} name="npsn" defaultValue={p.npsn ?? ''} inputMode="numeric" pattern="\d{8}" />
        <span className={forms.hint}>8 angka. Madrasah boleh mengisi NSM saja.</span>
        {fieldError(error, 'npsn') && <span className={forms.error}>{fieldError(error, 'npsn')}</span>}
      </label>
      <label className={forms.field}>
        <span className={forms.label}>NSM (madrasah)</span>
        <input className={forms.input} name="nsm" defaultValue={p.nsm ?? ''} inputMode="numeric" pattern="\d{12}" />
        {fieldError(error, 'nsm') && <span className={forms.error}>{fieldError(error, 'nsm')}</span>}
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Zona waktu</span>
        <select className={forms.input} name="timezone" defaultValue={p.timezone}>
          <option value="Asia/Jakarta">WIB (Jakarta)</option>
          <option value="Asia/Makassar">WITA (Makassar)</option>
          <option value="Asia/Jayapura">WIT (Jayapura)</option>
        </select>
      </label>
    </Shell>
  );
}

/** Features a profile turns on, for the summary before saving. */
function presetSummary(level: Level, isMadrasah: boolean): string[] {
  const caps = presetCapabilities(level, isMadrasah);
  return CAPABILITY_KEYS.flatMap((key) => {
    const value = caps[key];
    if (CAPABILITIES[key].kind === 'bool') return value === true ? [CAPABILITY_LABELS[key]] : [];
    if (value === 'off') return [];
    return [`${CAPABILITY_LABELS[key]}: ${CAPABILITY_VALUE_LABELS[String(value)] ?? String(value)}`];
  });
}

/** 2. Level and madrasah, with the resulting features shown before saving. */
export function LevelStep({ setup, schoolId, onCaps, onDone, onBack }: StepProps) {
  const { busy, message, run } = useSubmit();
  const [level, setLevel] = useState<Level>(setup.profile.level);
  const [madrasah, setMadrasah] = useState(setup.profile.isMadrasah);
  const submit = (e: FormEvent<HTMLFormElement>) =>
    void run(e, async () => {
      const res = await api('/school/profile', SchoolProfileResponse, {
        method: 'PATCH',
        body: { level, isMadrasah: madrasah },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      onCaps(res.capabilities);
      await onDone('done');
    });
  return (
    <Shell title="Jenjang sekolah" busy={busy} message={message} onBack={onBack} onSubmit={submit}>
      <fieldset className={styles.choices}>
        <legend className={forms.label}>Jenjang</legend>
        {LEVEL_OPTIONS.map((o) => (
          <label key={o.value} className={styles.choice}>
            <input type="radio" name="level" value={o.value} checked={level === o.value} onChange={() => setLevel(o.value)} />
            {o.label}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.choices}>
        <legend className={forms.label}>Madrasah (MI, MTs, MA, MAK)?</legend>
        {[
          [true, 'Ya, madrasah'],
          [false, 'Bukan'],
        ].map(([value, label]) => (
          <label key={String(value)} className={styles.choice}>
            <input type="radio" name="madrasah" checked={madrasah === value} onChange={() => setMadrasah(value as boolean)} />
            {label}
          </label>
        ))}
      </fieldset>
      <div className={styles.summary} aria-live="polite" data-testid="preset-summary">
        <strong>
          Yang aktif untuk {LEVEL_LABELS[level]}
          {madrasah ? ' (madrasah)' : ''}:
        </strong>
        <ul>
          {presetSummary(level, madrasah).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

function YesNo({ name, legend, defaultValue }: { name: string; legend: string; defaultValue: boolean }) {
  return (
    <fieldset className={styles.choices}>
      <legend className={forms.label}>{legend}</legend>
      <label className={styles.choice}>
        <input type="radio" name={name} value="ya" defaultChecked={defaultValue} required />
        Ya
      </label>
      <label className={styles.choice}>
        <input type="radio" name={name} value="tidak" defaultChecked={!defaultValue} />
        Tidak
      </label>
    </fieldset>
  );
}

/** 3. MBG recipient (cut-off time and PIC are set later). */
export function MbgStep({ schoolId, caps, onCaps, onDone, onBack }: StepProps) {
  const { busy, message, run } = useSubmit();
  const submit = (e: FormEvent<HTMLFormElement>) =>
    void run(e, async (d) => {
      onCaps(await setCapability(schoolId, 'mbg.enabled', d.get('mbg') === 'ya' ? true : null));
      await onDone('done');
    });
  return (
    <Shell
      title="Penerima Makan Bergizi Gratis?"
      hint="Bila ya, Absah menghitung jumlah siswa hadir untuk laporan MBG. Jam batas dan nomor PIC bisa diisi nanti."
      busy={busy}
      message={message}
      onBack={onBack}
      onSubmit={submit}
    >
      <YesNo name="mbg" legend="Sekolah menerima MBG" defaultValue={caps['mbg.enabled'] === true} />
    </Shell>
  );
}

/** 4. Student data import (the import flow itself arrives with prompt 2.1). */
export function ImportStep({ caps, onDone, onBack }: StepProps) {
  const { busy, message, run } = useSubmit();
  const source = caps['data.source'] === 'emis' ? 'EMIS' : 'Dapodik';
  return (
    <Shell
      title="Data siswa"
      hint={`Data siswa, rombel, dan guru diambil dari ${source}.`}
      busy={busy}
      message={message}
      onBack={onBack}
      submitLabel="Lewati dulu"
      onSubmit={(e) => void run(e, () => onDone('skipped'))}
    >
      <div className={styles.summary}>
        <strong>Import dari {source}</strong>
        <p className={forms.hint}>
          {source === 'Dapodik'
            ? 'Lanjutkan setup dulu. Setelah selesai, buka menu Import Dapodik di beranda: unggah berkas ekspor, periksa pratinjau, lalu terapkan.'
            : 'Import dari EMIS tersedia di pembaruan berikutnya. Anda bisa melanjutkan setup sekarang.'}
        </p>
      </div>
    </Shell>
  );
}

/** 5. Gate attendance on or off. */
export function GateStep({ schoolId, caps, onCaps, onDone, onBack }: StepProps) {
  const { busy, message, run } = useSubmit();
  const submit = (e: FormEvent<HTMLFormElement>) =>
    void run(e, async (d) => {
      onCaps(await setCapability(schoolId, 'gate.enabled', d.get('gate') === 'ya' ? true : null));
      await onDone('done');
    });
  return (
    <Shell
      title="Presensi gerbang"
      hint="Siswa memindai kartu QR di kios gerbang saat datang dan pulang."
      busy={busy}
      message={message}
      onBack={onBack}
      onSubmit={submit}
    >
      <YesNo name="gate" legend="Pakai presensi gerbang" defaultValue={caps['gate.enabled'] === true} />
    </Shell>
  );
}

const INVITE_ROLES = STAFF_ROLES.filter((r) => r !== 'pembimbing_industri');

/** 6. Invite staff by email or WhatsApp + role; links can be copied and shared. */
export function InviteStep({ schoolId, onDone, onBack }: StepProps) {
  const { busy, error, message, run } = useSubmit();
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [invited, setInvited] = useState<{ name: string; role: StaffRole; link: string }[]>([]);
  const [finishing, setFinishing] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    void run(e, async (d) => {
      const name = String(d.get('name') ?? '').trim();
      const contact = String(d.get('contact') ?? '').trim();
      const role = String(d.get('role')) as StaffRole;
      const res = await api('/school/invitations', InvitationResponse, {
        method: 'POST',
        body: channel === 'email' ? { name, email: contact, role } : { name, phoneNumber: toE164(contact), role },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      setInvited((list) => [...list, { name, role, link: res.inviteUrl }]);
      form.reset();
    });
  };

  return (
    <div className={forms.form}>
      <form className={forms.form} onSubmit={submit}>
        <h1 className={styles.title}>Undang staf</h1>
        <p className={forms.hint}>Kirim tautan undangan ke operator, guru, dan staf lain. Bisa juga dilakukan nanti.</p>
        <label className={forms.field}>
          <span className={forms.label}>Nama</span>
          <input className={forms.input} name="name" required minLength={2} />
        </label>
        <fieldset className={styles.choices}>
          <legend className={forms.label}>Kirim lewat</legend>
          <label className={styles.choice}>
            <input type="radio" name="channel" checked={channel === 'email'} onChange={() => setChannel('email')} />
            Email
          </label>
          <label className={styles.choice}>
            <input type="radio" name="channel" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} />
            WhatsApp
          </label>
        </fieldset>
        <label className={forms.field}>
          <span className={forms.label}>{channel === 'email' ? 'Email' : 'Nomor WhatsApp'}</span>
          <input
            className={forms.input}
            name="contact"
            type={channel === 'email' ? 'email' : 'tel'}
            inputMode={channel === 'email' ? 'email' : 'tel'}
            placeholder={channel === 'email' ? 'nama@sekolah.sch.id' : '0812…'}
            required
          />
          {(fieldError(error, 'email') ?? fieldError(error, 'phoneNumber')) && (
            <span className={forms.error}>{fieldError(error, 'email') ?? fieldError(error, 'phoneNumber')}</span>
          )}
        </label>
        <label className={forms.field}>
          <span className={forms.label}>Peran</span>
          <select className={forms.input} name="role" defaultValue="guru">
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        {message && (
          <p className={forms.error} role="alert">
            {message}
          </p>
        )}
        <Button type="submit" variant="secondary" disabled={busy}>
          Undang
        </Button>
      </form>

      {invited.length > 0 && (
        <ul className={styles.invited} aria-label="Sudah diundang">
          {invited.map((i) => (
            <li key={i.link}>
              <strong>
                {i.name} · {ROLE_LABELS[i.role]}
              </strong>
              <span className={styles.link}>{i.link}</span>
              <Button variant="secondary" onClick={() => void navigator.clipboard?.writeText(i.link)}>
                Salin tautan
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.nav}>
        {onBack ? (
          <Button variant="secondary" onClick={onBack}>
            Kembali
          </Button>
        ) : (
          <span />
        )}
        <Button
          disabled={finishing}
          onClick={() => {
            setFinishing(true);
            void onDone(invited.length > 0 ? 'done' : 'skipped').finally(() => setFinishing(false));
          }}
        >
          Selesai
        </Button>
      </div>
    </div>
  );
}
