'use client';

import { SessionDetail, TodayResponse, type SessionSummary } from '@absah/contracts';
import { Banner, EmptyState, ErrorState, GreetingHeader, PageMain, SegmentedControl, SessionGroup, SessionHero, SessionItem, SkeletonRows, messages } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ALL_SESSIONS_VIEWERS } from '@/lib/attendance';
import { isTransient, offlineStore, savedLabel, sessionCacheKey, todayCacheKey } from '@/lib/offline-queue';
import { clockOffset, greetingName, greetingPart, groupToday, minutesOfDay } from '@/lib/session-clock';
import { SESSIONS_SYNCED_EVENT } from '@/lib/sync-sessions';
import { useWorkspace } from '@/lib/workspace';

const t = messages.today;

const longDate = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

const GREETING = { morning: t.greetingMorning, noon: t.greetingNoon, afternoon: t.greetingAfternoon, night: t.greetingNight } as const;

/** "08:30" -> "08.30", as the design writes lesson times. */
const dotted = (hhmm: string) => hhmm.replace(':', '.');
const timeOf = (s: SessionSummary) => (s.period ? `${dotted(s.period.startsAt)}–${dotted(s.period.endsAt)}` : undefined);

/** The mode only changes the title of a card, never the layout: a lesson names its subject, a day or an activity says what it is. */
const titleOf = (s: SessionSummary) => (s.subject ? `${s.owner.name} · ${s.subject.name}` : s.mode === 'daily' ? `${s.owner.name} · Presensi harian` : s.owner.name);

/**
 * What a card says under the title. Numbers are the API's own: the screen never works out a status itself. A sent session says
 * how many were not there; the per-status split ("Hadir 24 · Izin 1") needs a field the API does not send yet (see the PR).
 */
function metaOf(s: SessionSummary, showTeacher: boolean): string {
  const parts: string[] = [];
  if (s.status === 'open' || s.status === 'missed') {
    if (s.period) parts.push(`Jam ke-${s.period.number}`);
    if (showTeacher) parts.push(s.teacher?.name ?? 'Belum ada guru');
    parts.push(`${s.counts.students} siswa`);
    return parts.join(' · ');
  }
  parts.push(t.sent, `${s.counts.students} siswa`);
  if (s.counts.absent > 0) parts.push(`${s.counts.absent} tidak hadir`);
  return parts.join(' · ');
}

/** Hari ini: what to fill now, what comes next, what is done (PRS-01). The one big action is the session in progress. */
export default function HariIniPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const timezone = me.schools.find((x) => x.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const canSeeAll = hasRole(...ALL_SESSIONS_VIEWERS);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Set while the list comes from the phone's copy (no signal). */
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  /** Server time minus the phone's clock, from the Date header of the last answer. */
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());

  // A lesson starts and ends on the minute, so look at the clock again every 30 seconds.
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    const store = offlineStore();
    const load = () =>
      api(`/attendance/today?scope=${scope}`, TodayResponse, {
        schoolId,
        // TODO(contract): the API sends no server time. The Date header of this very answer stands in until TodayResponse has `serverNow`.
        onResponse: (res) => {
          const o = clockOffset(res.headers.get('date'), Date.now());
          if (o !== null) setOffset(o);
        },
      })
        .then((d) => {
          setData(d);
          setCopyFrom(null);
          setError(null);
          setTick(Date.now());
          void store.keep(todayCacheKey(schoolId, scope), d);
          // Keep the sessions the user can still fill on the phone, so they open and can be filled without signal (PRS-08).
          for (const s of d.sessions.filter((x) => x.status === 'open' && x.canFill).slice(0, 12)) {
            // Warm the page shell too (the service worker keeps it), so the screen opens without signal.
            void fetch(`/sesi/${s.id}`, { headers: { 'x-absah-warm': '1' } }).catch(() => undefined);
            void api(`/sessions/${s.id}`, SessionDetail, { schoolId })
              .then((detail) => store.keep(sessionCacheKey(schoolId, s.id), detail))
              .catch(() => undefined);
          }
        })
        .catch(async (err: unknown) => {
          const copy = isTransient(err) ? await store.cached(todayCacheKey(schoolId, scope)) : null;
          const parsed = TodayResponse.safeParse(copy?.value);
          if (copy && parsed.success) {
            setData(parsed.data);
            setCopyFrom(savedLabel(copy.savedAt, timezone));
          } else setError(err instanceof ApiError ? err.message : t.errorBody);
        });
    void load();
    window.addEventListener(SESSIONS_SYNCED_EVENT, load);
    return () => window.removeEventListener(SESSIONS_SYNCED_EVENT, load);
  }, [schoolId, scope, timezone, attempt]);

  const nowMinutes = minutesOfDay(new Date(tick + offset), timezone);
  const groups = useMemo(() => (data ? groupToday(data.sessions, nowMinutes) : null), [data, nowMinutes]);

  const showHero = scope === 'mine';
  const hero = showHero ? groups?.current[0] : undefined;
  const inProgress = showHero ? [] : (groups?.current ?? []);
  const toFill = [...(showHero ? (groups?.current.slice(1) ?? []) : []), ...(groups?.unfilled ?? [])];
  const link = (s: SessionSummary) => `/sesi/${s.id}`;
  const showTeacher = scope === 'all';
  const empty = data?.sessions.length === 0;

  return (
    <PageMain>
      <GreetingHeader
        date={data ? longDate(data.schoolDate) : ''}
        greeting={`${GREETING[greetingPart(nowMinutes)]}, ${greetingName(me.user.name)}`}
      />
      {canSeeAll && (
        <SegmentedControl
          label={t.scope}
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: t.scopeMine },
            { value: 'all', label: t.scopeAll },
          ]}
        />
      )}
      {copyFrom && (
        <Banner kind="offline">
          {t.offline.replace('{time}', copyFrom)}
        </Banner>
      )}
      {error && (
        <ErrorState title={t.errorTitle} onRetry={() => { setError(null); setAttempt((n) => n + 1); }}>
          {t.errorBody}
        </ErrorState>
      )}
      {!data && !error && <SkeletonRows count={3} />}
      {empty && (
        <EmptyState title={scope === 'mine' ? t.empty : t.emptyAll}>{scope === 'mine' ? t.emptyBody : t.emptyAllBody}</EmptyState>
      )}
      {hero && <SessionHero time={timeOf(hero)} title={titleOf(hero)} meta={metaOf(hero, false)} href={link(hero)} actionLabel={`${t.fill} ${titleOf(hero)}`} linkAs={Link} />}
      {inProgress.length > 0 && (
        <SessionGroup title={t.current}>
          {inProgress.map((s) => (
            <SessionItem key={s.id} variant="unfilled" time={timeOf(s)} title={titleOf(s)} meta={metaOf(s, showTeacher)} href={link(s)} linkAs={Link} />
          ))}
        </SessionGroup>
      )}
      {toFill.length > 0 && (
        <SessionGroup title={t.unfilled}>
          {toFill.map((s) => (
            <SessionItem key={s.id} variant="unfilled" time={timeOf(s)} title={titleOf(s)} meta={metaOf(s, showTeacher)} href={link(s)} linkAs={Link} />
          ))}
        </SessionGroup>
      )}
      {groups && groups.next.length > 0 && (
        <SessionGroup title={t.next}>
          {groups.next.map((s) => (
            <SessionItem key={s.id} variant="next" time={timeOf(s)} title={titleOf(s)} meta={metaOf(s, showTeacher)} href={link(s)} linkAs={Link} />
          ))}
        </SessionGroup>
      )}
      {groups && groups.done.length > 0 && (
        <SessionGroup title={t.done}>
          {groups.done.map((s) => (
            <SessionItem
              key={s.id}
              variant={s.status === 'missed' ? 'missed' : s.status === 'locked' ? 'locked' : 'done'}
              time={timeOf(s)}
              title={titleOf(s)}
              meta={metaOf(s, showTeacher)}
              href={link(s)}
              linkAs={Link}
            />
          ))}
        </SessionGroup>
      )}
    </PageMain>
  );
}
