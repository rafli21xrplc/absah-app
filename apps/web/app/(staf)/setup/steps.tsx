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
import { Button, ChoiceGroup, Field, Input, PresetSummary, Select, WizardNav, messages } from '@absah/ui';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { CAPABILITY_LABELS, CAPABILITY_VALUE_LABELS } from '@/lib/capability-labels';
import { LEVEL_LABELS, LEVEL_OPTIONS } from '@/lib/levels';
import { ROLE_LABELS } from '@/lib/roles';
import { toE164 } from '@/lib/phone';

const t = messages.setup;
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');

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
        ? t.checkFields
        : error.message
      : error
        ? t.notConnected
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
    <form className="flex flex-col gap-5" onSubmit={props.onSubmit}>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h2">{props.title}</h1>
        {props.hint && <p className="m-0 text-isi text-tinta-muted">{props.hint}</p>}
      </div>
      {/* Two columns from 1024 px; a field or question that needs the room spans both (lg:col-span-2). */}
      <div className="grid gap-4 lg:grid-cols-2">{props.children}</div>
      {props.message && (
        <p role="alert" className="m-0 text-body text-alpa">
          {props.message}
        </p>
      )}
      <WizardNav onBack={props.onBack} backLabel={t.back}>
        {props.extra}
        <Button type="submit" loading={props.busy}>
          {props.submitLabel ?? t.next}
        </Button>
      </WizardNav>
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
    <Shell title={t.profileTitle} busy={busy} message={message} onBack={onBack} onSubmit={submit}>
      <Field label={t.schoolName} error={fieldError(error, 'name') ?? undefined}>
        <Input name="name" defaultValue={p.name} required minLength={3} maxLength={120} />
      </Field>
      <Field label={t.npsn} hint={t.npsnHint} error={fieldError(error, 'npsn') ?? undefined}>
        <Input name="npsn" defaultValue={p.npsn ?? ''} inputMode="numeric" pattern="\d{8}" />
      </Field>
      <Field label={t.nsm} error={fieldError(error, 'nsm') ?? undefined}>
        <Input name="nsm" defaultValue={p.nsm ?? ''} inputMode="numeric" pattern="\d{12}" />
      </Field>
      <Field label={t.timezone}>
        <Select name="timezone" defaultValue={p.timezone}>
          <option value="Asia/Jakarta">{t.wib}</option>
          <option value="Asia/Makassar">{t.wita}</option>
          <option value="Asia/Jayapura">{t.wit}</option>
        </Select>
      </Field>
    </Shell>
  );
}

/** Features a profile turns on, for the summary before saving. */
function presetSummary(level: Level, isMadrasah: boolean): string[] {
  return describeCaps(presetCapabilities(level, isMadrasah));
}

/** The switched-on features in words, e.g. "Mode presensi: per jam pelajaran". Values as the API gives them. */
export function describeCaps(caps: Caps): string[] {
  return CAPABILITY_KEYS.flatMap((key) => {
    const value = caps[key];
    if (value === undefined || value === null) return [];
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
    <Shell title={t.levelTitle} busy={busy} message={message} onBack={onBack} onSubmit={submit}>
      <ChoiceGroup
        legend={t.level}
        name="level"
        columns={4}
        className="lg:col-span-2"
        options={LEVEL_OPTIONS.map((o) => ({ ...o, hint: t.levelHints[o.value] }))}
        value={level}
        onValueChange={(v) => setLevel(v as Level)}
      />
      <ChoiceGroup
        legend={t.madrasahQuestion}
        columns={2}
        className="lg:col-span-2"
        name="madrasah"
        options={[
          { value: 'ya', label: t.madrasahYes },
          { value: 'bukan', label: t.madrasahNo },
        ]}
        value={madrasah ? 'ya' : 'bukan'}
        onValueChange={(v) => setMadrasah(v === 'ya')}
      />
      <div className="lg:col-span-2">
        <PresetSummary testId="preset-summary" title={fill(t.presetTitle, { level: LEVEL_LABELS[level], madrasah: madrasah ? t.madrasahSuffix : '' })} items={presetSummary(level, madrasah)} />
      </div>
    </Shell>
  );
}

function YesNo({ name, legend, defaultValue }: { name: string; legend: string; defaultValue: boolean }) {
  return (
    <ChoiceGroup
      legend={legend}
      name={name}
      required
      columns={2}
      className="lg:col-span-2"
      defaultValue={defaultValue ? 'ya' : 'tidak'}
      options={[
        { value: 'ya', label: t.yes },
        { value: 'tidak', label: t.no },
      ]}
    />
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
      title={t.mbgTitle}
      hint={t.mbgHint}
      busy={busy}
      message={message}
      onBack={onBack}
      onSubmit={submit}
    >
      <YesNo name="mbg" legend={t.mbgLegend} defaultValue={caps['mbg.enabled'] === true} />
    </Shell>
  );
}

/** 4. Student data import (the import flow itself arrives with prompt 2.1). */
export function ImportStep({ caps, onDone, onBack }: StepProps) {
  const { busy, message, run } = useSubmit();
  const source = caps['data.source'] === 'emis' ? 'EMIS' : 'Dapodik';
  return (
    <Shell title={t.importTitle} hint={fill(t.importHint, { source })} busy={busy} message={message} onBack={onBack} submitLabel={t.skipForNow} onSubmit={(e) => void run(e, () => onDone('skipped'))}>
      <div className="flex flex-col gap-2 rounded-ubin bg-ubin p-4 lg:col-span-2">
        <strong className="text-isi-strong">{fill(t.importFrom, { source })}</strong>
        <p className="m-0 text-isi text-tinta-muted">{source === 'Dapodik' ? t.importDapodik : t.importEmis}</p>
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
      title={t.gateTitle}
      hint={t.gateHint}
      busy={busy}
      message={message}
      onBack={onBack}
      onSubmit={submit}
    >
      <YesNo name="gate" legend={t.gateLegend} defaultValue={caps['gate.enabled'] === true} />
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
    <div className="flex flex-col gap-5">
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-h2">{t.inviteTitle}</h1>
          <p className="m-0 text-isi text-tinta-muted">{t.inviteHint}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
        <Field label={t.name}>
          <Input name="name" required minLength={2} />
        </Field>
        <ChoiceGroup
          legend={t.sendVia}
          name="channel"
          columns={2}
          options={[
            { value: 'email', label: t.email },
            { value: 'whatsapp', label: t.whatsapp },
          ]}
          value={channel}
          onValueChange={(v) => setChannel(v as 'email' | 'whatsapp')}
        />
        <Field label={channel === 'email' ? t.email : t.whatsappNumber} error={(fieldError(error, 'email') ?? fieldError(error, 'phoneNumber')) ?? undefined}>
          <Input name="contact" type={channel === 'email' ? 'email' : 'tel'} inputMode={channel === 'email' ? 'email' : 'tel'} placeholder={channel === 'email' ? 'nama@sekolah.sch.id' : '0812…'} required />
        </Field>
        <Field label={t.role}>
          <Select name="role" defaultValue="guru">
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        </div>
        {message && (
          <p role="alert" className="m-0 text-body text-alpa">
            {message}
          </p>
        )}
        <Button type="submit" variant="secondary" loading={busy} className="self-start">
          {t.invite}
        </Button>
      </form>

      {invited.length > 0 && (
        <ul aria-label={t.invited} className="m-0 grid list-none gap-2 p-0 lg:grid-cols-2">
          {invited.map((i) => (
            <li key={i.link} className="flex flex-col gap-1 rounded-lg border border-garis bg-kapur-raised p-3">
              <strong className="text-body-strong">
                {i.name} · {ROLE_LABELS[i.role]}
              </strong>
              <span className="break-all text-small text-tinta-muted">{i.link}</span>
              <Button variant="secondary" className="self-start" onClick={() => void navigator.clipboard?.writeText(i.link)}>
                {t.copyLink}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <WizardNav onBack={onBack} backLabel={t.back}>
        <Button
          loading={finishing}
          onClick={() => {
            setFinishing(true);
            void onDone(invited.length > 0 ? 'done' : 'skipped').finally(() => setFinishing(false));
          }}
        >
          {t.finish}
        </Button>
      </WizardNav>
    </div>
  );
}
