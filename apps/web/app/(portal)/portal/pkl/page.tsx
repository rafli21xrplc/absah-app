'use client';

import { CreatePklAttachmentResponse, PklCheckin, PklJournal, PklToday, type PklCheckinBody } from '@absah/contracts';
import { Banner, Button, Card, ErrorState, Field, Input, PageMain, SkeletonRows, Textarea, messages } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { putPhoto, toJpeg } from '@/lib/pickup';
import { clockIn, CONFIRM_LABELS, readPosition, REASON_LABELS, STATUS_WORDS } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import { PklJournals } from '../../../_pkl/journals';

const t = messages.pkl;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/** One press of Check-in/Check-out: the same key and body are resent until the server answered. */
interface Attempt {
  key: string;
  body: PklCheckinBody;
}

function checkinText(c: PklCheckin, timezone: string): string {
  const what = c.kind === 'in' ? t.came : t.left;
  const state = c.status ? STATUS_WORDS[c.status] : c.confirmStatus ? CONFIRM_LABELS[c.confirmStatus] : 'tercatat';
  const reasons = c.reviewReasons.length > 0 && !c.status ? ` (${c.reviewReasons.map((r) => REASON_LABELS[r]).join(', ')}; guru pembimbing akan meninjau)` : '';
  return `${what} ${clockIn(c.recordedAt, timezone)} · ${c.distanceM} m dari DUDI · ${state}${reasons}`;
}

/** PKL for the student (PKL-02/03): check in and out at the DUDI, and write today's journal. */
export default function PortalPklPage() {
  const { me, schoolId, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [today, setToday] = useState<PklToday | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const attempt = useRef<Attempt | null>(null);
  const journalKey = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/pkl/me', PklToday, { schoolId })
      .then(setToday)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t.loadFailedBody));
  }, [schoolId]);
  useEffect(load, [load]);

  async function check(kind: 'in' | 'out') {
    setBusy(true);
    setError(null);
    try {
      if (attempt.current?.body.kind !== kind) {
        const p = await readPosition();
        attempt.current = { key: newIdempotencyKey(), body: { kind, ...p, deviceTime: new Date().toISOString() } };
      }
      await api('/pkl/checkins', PklCheckin, { method: 'POST', schoolId, idempotencyKey: attempt.current.key, body: attempt.current.body });
      attempt.current = null;
      load();
    } catch (err) {
      // The server answered: this press is over (409 already_recorded, no_placement, ...).
      if (err instanceof ApiError) attempt.current = null;
      setError(err instanceof Error ? err.message : t.notSent);
      if (err instanceof ApiError && err.status === 409) load();
    } finally {
      setBusy(false);
    }
  }

  async function writeJournal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const d = new FormData(formEl);
    const file = d.get('file');
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      let attachment: { id: string; contentType: 'image/jpeg' | 'application/pdf' } | undefined;
      if (file instanceof File && file.size > 0) {
        const pdf = file.type === 'application/pdf';
        const blob = pdf ? file : await toJpeg(file);
        const contentType = pdf ? 'application/pdf' : 'image/jpeg';
        const up = await api('/pkl/journals/attachments', CreatePklAttachmentResponse, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { fileSize: blob.size, contentType } });
        await putPhoto(up.upload, blob);
        attachment = { id: up.attachmentId, contentType };
      }
      journalKey.current ??= newIdempotencyKey();
      const body = { activity: String(d.get('activity') ?? '').trim(), competency: String(d.get('competency') ?? '').trim() || null, ...(attachment ? { attachment } : {}) };
      await api('/pkl/journals', PklJournal, { method: 'POST', schoolId, idempotencyKey: journalKey.current, body });
      journalKey.current = null;
      formEl.reset();
      setSaved(t.journalSaved);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.journalFailed);
    } finally {
      setBusy(false);
    }
  }

  const p = today?.placement;
  return (
    <IfCap name="pkl.enabled" fallback={<PageMain><p className="m-0 text-body">{t.disabled}</p></PageMain>}>
      <PageMain>
        <Link href="/portal" className="text-body-strong text-papan">
          {t.back}
        </Link>
        <h1 className="m-0 text-h1">{t.title}</h1>
        {!hasRole('siswa') && <p className="m-0 text-body">{t.studentsOnly}</p>}
        {error && !today && (
          <ErrorState title={t.loadFailed} onRetry={() => { setError(null); load(); }}>
            {error}
          </ErrorState>
        )}
        {error && today && (
          <Banner kind="error" title={t.notSent}>
            <span role="alert">{error}</span>
          </Banner>
        )}
        {!today && !error && <SkeletonRows count={3} />}
        {today && !p && <p className="m-0 text-body">{t.noPlacement}</p>}
        {p && schoolId && (
          <>
            <Card as="section" aria-label={t.placeLabel} className="flex flex-col gap-1">
              <strong className="text-h3">{p.partner.name}</strong>
              <span className="text-body text-tinta-muted">{p.partner.address}</span>
              <span className="text-body">{p.hours ? fill(t.hours, { start: p.hours.startsAt.replace(':', '.'), end: p.hours.endsAt.replace(':', '.') }) : t.dudiOff}</span>
              <span className="text-body">{fill(t.mentors, { school: p.schoolMentor ?? '–', industry: p.industryMentor ?? t.noMentor })}</span>
            </Card>
            <Card as="section" aria-label={t.todayLabel} className="flex flex-col gap-3">
              <h2 className="m-0 text-h2">{t.todayLabel}</h2>
              {today.checkIn && (
                <p role="status" className="m-0 text-body">
                  {checkinText(today.checkIn, timezone)}
                </p>
              )}
              {today.checkOut && (
                <p role="status" className="m-0 text-body">
                  {checkinText(today.checkOut, timezone)}
                </p>
              )}
              {!today.checkIn && (
                <Button size="64" disabled={busy} onClick={() => void check('in')}>
                  {busy ? t.reading : t.checkIn}
                </Button>
              )}
              {today.checkIn && !today.checkOut && (
                <Button size="64" variant="secondary" disabled={busy} onClick={() => void check('out')}>
                  {busy ? t.reading : t.checkOut}
                </Button>
              )}
              <p className="m-0 text-small text-tinta-muted">{fill(t.locationNote, { radius: p.partner.radiusM })}</p>
            </Card>
            <Card as="section" aria-labelledby="jurnal-baru">
              <form onSubmit={(e) => void writeJournal(e)} onChange={() => (journalKey.current = null)} className="flex flex-col gap-4">
                <h2 id="jurnal-baru" className="m-0 text-h2">
                  {t.journalTitle}
                </h2>
                <Field label={t.activity}>
                  <Textarea name="activity" required minLength={5} maxLength={2000} rows={4} />
                </Field>
                <Field label={t.competency}>
                  <Input name="competency" maxLength={300} />
                </Field>
                <Field label={t.file}>
                  <Input name="file" type="file" accept="image/*,application/pdf" />
                </Field>
                <Button type="submit" loading={busy}>
                  {t.sendJournal}
                </Button>
                {saved && (
                  <p role="status" className="m-0 text-body text-hadir">
                    {saved}
                  </p>
                )}
              </form>
            </Card>
            <h2 className="m-0 text-h2">{t.myJournals}</h2>
            <PklJournals schoolId={schoolId} reload={reload} showStudent={false} />
          </>
        )}
      </PageMain>
    </IfCap>
  );
}
