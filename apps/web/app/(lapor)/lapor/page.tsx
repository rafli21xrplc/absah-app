'use client';

import { TppkChannel, TppkReportReceipt, type TppkReportCategory, type TppkReporterRelation } from '@absah/contracts';
import { Banner, Button, DateInput, Field, Input, messages, PageMain, Select, SkeletonRows, Textarea } from '@absah/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABELS, formatCode, RELATION_LABELS, RELATIONS } from '@/lib/tppk';

const t = messages.report;
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Channel = { state: 'loading' } | { state: 'closed' } | { state: 'open'; schoolName: string };

/**
 * Lapor ke TPPK (KSW-06): calm and short. Anonymous by default; an anonymous report is sent without
 * cookies, so not even the session travels with it. Nothing is stored in the browser.
 */
function LaporForm() {
  const schoolId = useSearchParams().get('s') ?? '';
  const [channel, setChannel] = useState<Channel>({ state: 'loading' });
  const [category, setCategory] = useState<TppkReportCategory | ''>('');
  const [chronology, setChronology] = useState('');
  const [occurredOn, setOccurredOn] = useState('');
  const [relation, setRelation] = useState<TppkReporterRelation | ''>('');
  const [anonymous, setAnonymous] = useState(true);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!UUID_RE.test(schoolId)) {
      void Promise.resolve().then(() => setChannel({ state: 'closed' }));
      return;
    }
    api(`/tppk/channel/${schoolId}`, TppkChannel, { anonymous: true })
      .then((c) => setChannel({ state: 'open', schoolName: c.schoolName }))
      .catch(() => setChannel({ state: 'closed' }));
  }, [schoolId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!category) return setProblem(t.pickCategory);
    if (!relation) return setProblem(t.pickRelation);
    if (chronology.trim().length < 20) return setProblem(t.tooShort);
    setProblem(null);
    setBusy(true);
    setError(null);
    try {
      const body = {
        schoolId,
        category,
        chronology,
        reporterRelation: relation,
        anonymous,
        ...(occurredOn ? { occurredOn } : {}),
        ...(!anonymous && name.trim() ? { reporterName: name } : {}),
        ...(!anonymous && contact.trim() ? { reporterContact: contact } : {}),
      };
      const receipt = await api('/tppk/reports', TppkReportReceipt, { method: 'POST', body, anonymous });
      setCode(receipt.trackingCode);
      // The story leaves the page as soon as it is sent.
      setChronology('');
      setName('');
      setContact('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (channel.state === 'loading') return <SkeletonRows count={3} />;
  if (channel.state === 'closed') {
    return (
      <>
        <h1 className="m-0 text-h1">{t.closedTitle}</h1>
        <p className="m-0 text-body text-tinta-muted">{t.closedBody}</p>
      </>
    );
  }

  if (code) {
    return (
      <>
        <h1 className="m-0 text-h1">{t.receivedTitle}</h1>
        <p className="m-0 text-body">{fill(t.receivedThanks, { school: channel.schoolName })}</p>
        <p className="m-0 text-body text-tinta-muted">{t.receivedCode}</p>
        <p className="m-0 rounded-lg border-2 border-dashed border-papan p-4 text-center font-mono text-h1 tracking-widest" data-testid="tracking-code">
          {formatCode(code)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(formatCode(code)).then(() => setCopied(true));
            }}
          >
            {copied ? t.copied : t.copy}
          </Button>
          <Link href="/lapor/lacak" className="text-body-strong text-papan">
            {t.track}
          </Link>
        </div>
      </>
    );
  }

  const apiProblem = error instanceof ApiError && error.status === 429 ? t.tooMany : error instanceof ApiError ? error.message : error ? t.notSent : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h1">{t.title}</h1>
        <p className="m-0 text-body text-tinta-muted">{channel.schoolName}</p>
      </div>
      <p className="m-0 text-body">{t.privacy}</p>
      <Banner kind="warning" title={t.safetyTitle}>
        {t.safety}
      </Banner>

      <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)}>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-small font-semibold text-tinta">{t.whatHappened}</legend>
          {CATEGORIES.map((c) => (
            <label key={c} className="grid min-h-11 cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 rounded-md border border-garis-kuat bg-kapur-raised px-3 py-2 text-body text-tinta">
              <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="mt-1 size-5 accent-papan" />
              <span className="text-body-strong">{CATEGORY_LABELS[c].label}</span>
              <span className="col-start-2 text-small text-tinta-muted">{CATEGORY_LABELS[c].hint}</span>
            </label>
          ))}
        </fieldset>

        <Field label={t.story} hint={t.storyHint} error={fieldError(error, 'chronology') ?? undefined}>
          <Textarea rows={7} value={chronology} onChange={(e) => setChronology(e.target.value)} maxLength={5000} />
        </Field>

        <Field label={t.date}>
          <DateInput type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </Field>

        <Field label={t.iAm}>
          <Select value={relation} onChange={(e) => setRelation(e.target.value as TppkReporterRelation)}>
            <option value="">{t.choose}</option>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {RELATION_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 text-body text-tinta">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 size-5 accent-papan" />
          <span className="flex flex-col">
            {t.anonymous}
            <span className="text-small text-tinta-muted">{t.anonymousHint}</span>
          </span>
        </label>

        {!anonymous && (
          <>
            <Field label={t.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" />
            </Field>
            <Field label={t.contact}>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={100} autoComplete="off" />
            </Field>
          </>
        )}

        {(problem ?? apiProblem) && (
          <p role="alert" className="m-0 text-body text-alpa">
            {problem ?? apiProblem}
          </p>
        )}
        <Button type="submit" size="52" loading={busy}>
          {t.send}
        </Button>
      </form>
      <p className="m-0 text-body text-tinta-muted">
        {t.already}{' '}
        <Link href="/lapor/lacak" className="text-papan">
          {t.trackWithCode}
        </Link>
        .
      </p>
    </>
  );
}

export default function LaporPage() {
  return (
    <PageMain>
      <Suspense fallback={<SkeletonRows count={3} />}>
        <LaporForm />
      </Suspense>
    </PageMain>
  );
}
