'use client';

import { CorrectionList, SessionDetail, TodayResponse, type AttendanceStatus } from '@absah/contracts';
import { AttendanceFlow, Banner, Button, ErrorState, PageMain, SkeletonRows, messages, type FlowStudent, type SendResult } from '@absah/ui';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { SOURCE_LABELS, STATUS_LABELS, type ExceptionStatus } from '@/lib/attendance';
import { isTransient, offlineStore, queuedId, queueSession, savedLabel, sessionCacheKey } from '@/lib/offline-queue';
import { groupToday, minutesOfDay } from '@/lib/session-clock';
import { SESSIONS_SYNCED_EVENT } from '@/lib/sync-sessions';
import { useWorkspace } from '@/lib/workspace';

const t = messages.presensi;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/** "2026-01-25" -> "Minggu, 25 Januari". The date is a calendar day of the school, so it is read as UTC and never shifted. */
const dateLabel = (schoolDate: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${schoolDate}T00:00:00Z`));

const helpKey = (userId: string) => `absah.presensi.help.${userId}`;
/** The help card opens by itself until this teacher has closed it once. Storage may be blocked: then it simply shows every time. */
function helpSeen(userId: string): boolean {
  try {
    return window.localStorage.getItem(helpKey(userId)) === '1';
  } catch {
    return false;
  }
}

/** The exceptions that were given and wait in the phone's queue, or null. */
type Queued = Awaited<ReturnType<ReturnType<typeof offlineStore>['queue']>>[number];

/** Fill one session with one thumb: Semua hadir, tap the ones who are not there, check, send (PRS-03). */
export default function SesiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { schoolId, me } = useWorkspace();
  const userId = me.user.id;
  const timezone = me.schools.find((x) => x.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [queued, setQueued] = useState<Queued | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Set while the roster comes from the phone's copy (no signal). */
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [next, setNext] = useState<{ label: string; href: string } | null>(null);
  /** One key per payload: sending the same answers again is the same action, different answers are a new one. */
  const sent = useRef<{ signature: string; key: string } | null>(null);

  /** Reads the session: the API, else (no signal) the phone's copy; and what already waits in the queue. */
  const read = useCallback(async () => {
    const store = offlineStore();
    const waiting = (await store.queue(userId)).find((q) => q.sessionId === id) ?? null;
    try {
      const d = await api(`/sessions/${id}`, SessionDetail, { schoolId });
      void store.keep(sessionCacheKey(schoolId ?? '', id), d);
      return { d, waiting, copyFrom: null as string | null, error: null as string | null };
    } catch (err) {
      const copy = isTransient(err) ? await store.cached(sessionCacheKey(schoolId ?? '', id)) : null;
      const parsed = SessionDetail.safeParse(copy?.value);
      if (copy && parsed.success) return { d: parsed.data, waiting, copyFrom: savedLabel(copy.savedAt, timezone), error: null };
      return { d: null, waiting, copyFrom: null, error: err instanceof ApiError ? err.message : t.noCopy };
    }
  }, [schoolId, id, userId, timezone]);

  const apply = useCallback((r: Awaited<ReturnType<typeof read>>) => {
    if (!r.d) {
      setError(r.error ?? t.loadFailed);
      return;
    }
    setError(null);
    setCopyFrom(r.copyFrom);
    setDetail(r.d);
    setQueued(r.waiting);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    const reload = () => void read().then(apply);
    reload();
    window.addEventListener(SESSIONS_SYNCED_EVENT, reload);
    return () => window.removeEventListener(SESSIONS_SYNCED_EVENT, reload);
  }, [schoolId, read, apply, attempt]);

  // Where "Lanjut ke ..." goes after sending: the session in progress, else the next one today. Not worth an error when it fails.
  useEffect(() => {
    if (!schoolId) return;
    let alive = true;
    api('/attendance/today?scope=mine', TodayResponse, { schoolId })
      .then((today) => {
        if (!alive) return;
        const groups = groupToday(today.sessions.filter((s) => s.id !== id && s.canFill), minutesOfDay(new Date(), timezone));
        const target = groups.current[0] ?? groups.unfilled[0] ?? groups.next[0];
        if (!target) return setNext(null);
        const name = target.subject ? `${target.owner.name} · ${target.subject.name}` : target.owner.name;
        setNext({ label: target.period ? `${name}, ${target.period.startsAt}` : name, href: `/sesi/${target.id}` });
      })
      .catch(() => alive && setNext(null));
    return () => {
      alive = false;
    };
  }, [schoolId, id, timezone]);

  const locked = detail ? detail.status === 'locked' || detail.status === 'missed' : false;
  const lesson = detail?.mode === 'per_period';

  /** What the screen starts from: what is recorded, "?" for nobody recorded. Answers waiting in the queue were a complete class. */
  const students = useMemo<FlowStudent[]>(() => {
    if (!detail) return [];
    const given = new Map((queued?.exceptions ?? []).map((e) => [e.enrollmentId, e.status as AttendanceStatus]));
    return detail.students.map((s) => {
      const base = s.fixed ? s.status : (given.get(s.enrollmentId) ?? s.status ?? (queued ? 'H' : null));
      return {
        id: s.enrollmentId,
        name: s.name,
        mark: base ?? '?',
        fixed: s.fixed && s.status !== null,
        ...(s.fixed && s.status ? { detail: `${STATUS_LABELS[s.status]}${s.source ? ` · ${SOURCE_LABELS[s.source]}` : ''}` } : {}),
      };
    });
  }, [detail, queued]);

  async function submit(input: { exceptions: { id: string; status: string }[]; topic: string }): Promise<SendResult> {
    if (!detail) return { kind: 'failed' };
    const exceptions = input.exceptions.map((e) => ({ enrollmentId: e.id, status: e.status as AttendanceStatus }));
    const body = lesson ? { exceptions, topic: input.topic } : { exceptions };
    const signature = JSON.stringify(body);
    if (sent.current?.signature !== signature) sent.current = { signature, key: newIdempotencyKey() };
    try {
      const saved = await api(`/sessions/${id}/submit`, SessionDetail, { method: 'POST', body, schoolId, idempotencyKey: sent.current.key });
      sent.current = null;
      setQueued(null);
      setDetail(saved);
      return { kind: 'sent' };
    } catch (err) {
      if (!isTransient(err) || !schoolId) return err instanceof ApiError ? { kind: 'failed', message: err.message } : { kind: 'failed' };
      // No signal (PRS-08): keep it on the phone; it goes out by itself, and a lock meanwhile becomes a correction request.
      await queueSession({
        id: queuedId(userId, id),
        userId,
        schoolId,
        sessionId: id,
        title: detail.owner.name + (detail.subject ? ` · ${detail.subject.name}` : ''),
        exceptions: exceptions.map((e) => ({ enrollmentId: e.enrollmentId, status: e.status as ExceptionStatus })),
        ...(lesson ? { topic: input.topic } : {}),
        capturedAt: new Date().toISOString(),
        idempotencyKey: newIdempotencyKey(),
      });
      void read().then(apply);
      return { kind: 'queued' };
    }
  }

  async function requestCorrection(changes: { id: string; status: string }[], reason: string): Promise<SendResult> {
    const body = { changes: changes.map((c) => ({ enrollmentId: c.id, status: c.status })), reason };
    const signature = JSON.stringify(body);
    if (sent.current?.signature !== signature) sent.current = { signature, key: newIdempotencyKey() };
    try {
      const created = await api(`/sessions/${id}/corrections`, CorrectionList, { method: 'POST', body, schoolId, idempotencyKey: sent.current.key });
      sent.current = null;
      setDone(fill(t.correctionSent, { n: created.items.length }));
      setCorrecting(false);
      return { kind: 'sent' };
    } catch (err) {
      return err instanceof ApiError ? { kind: 'failed', message: err.message } : { kind: 'failed' };
    }
  }

  if (!detail) {
    return (
      <PageMain>
        <Link href="/hari-ini" className="text-body">
          {t.back}
        </Link>
        <h1 className="sr-only">{t.back}</h1>
        {error ? (
          <ErrorState title={t.loadFailed} onRetry={() => { setError(null); setAttempt((n) => n + 1); }}>
            {error}
          </ErrorState>
        ) : (
          <SkeletonRows count={5} />
        )}
      </PageMain>
    );
  }

  const title = detail.subject ? `${detail.owner.name} · ${detail.subject.name}` : detail.owner.name;
  const subtitle = detail.period ? fill(t.period, { n: detail.period.number, start: detail.period.startsAt, end: detail.period.endsAt }) : t.dailyTitle;
  const banners = (
    <>
      {copyFrom && (
        <Banner kind="offline" title={t.copyBannerTitle} className="rounded-none border-x-0">
          {fill(t.copyBanner, { time: copyFrom })}
        </Banner>
      )}
      {queued && !copyFrom && (
        <Banner kind="offline" title={t.waitingTitle} className="rounded-none border-x-0">
          {t.waiting}
        </Banner>
      )}
      {done && (
        <Banner kind="info" title={t.correctionSentTitle} className="rounded-none border-x-0">
          {done}
        </Banner>
      )}
    </>
  );
  const readOnly = !correcting && (locked || !detail.canFill);

  return (
    <AttendanceFlow
      key={`${id}:${correcting ? 'koreksi' : 'isi'}`}
      title={title}
      subtitle={subtitle}
      dateLabel={dateLabel(detail.schoolDate)}
      shortTitle={detail.owner.name}
      students={students}
      backHref="/hari-ini"
      linkAs={Link}
      withTopic={Boolean(lesson) && !readOnly && !correcting}
      initialTopic={queued?.topic ?? detail.topic ?? ''}
      showHelpFirst={!readOnly && !correcting && !helpSeen(userId)}
      onHelpSeen={() => {
        try {
          window.localStorage.setItem(helpKey(userId), '1');
        } catch {
          // Without storage the card simply comes back next time.
        }
      }}
      next={next}
      banner={banners}
      readOnly={readOnly}
      readOnlyNote={
        <>
          {locked && (
            <div className="flex flex-col items-start gap-2 rounded-md border border-garis bg-kapur-raised p-4">
              <p className="m-0 text-body">{t.locked}</p>
              <Button variant="secondary" onClick={() => { setDone(null); setCorrecting(true); }}>
                {t.askCorrection}
              </Button>
            </div>
          )}
          {lesson && detail.topic && <p className="m-0 text-body text-tinta-muted">{fill(t.topicShown, { topic: detail.topic })}</p>}
        </>
      }
      correction={correcting ? { onSubmit: requestCorrection, onCancel: () => setCorrecting(false) } : undefined}
      onSubmit={submit}
    />
  );
}
