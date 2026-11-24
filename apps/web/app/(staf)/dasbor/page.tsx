'use client';

import { ClassRecapList, CollectionDashboardList, LeaveRequestList, MbgDaily, MbgForecast, PrincipalDashboard, ReportSemesterList, TodayResponse } from '@absah/contracts';
import { AlertRow, BarList, BoardSection, buttonStyles, cx, PageMain, StatusBoard, Table, TableBody, TableHead, TableRow, Td, Th, messages, type BarItem, type StatusBoxData } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { DASHBOARD_READERS, kindsLine, mbgLine, presentCaption, sessionsLine, warningCode } from '@/lib/dashboard';
import { GATE_VIEWERS } from '@/lib/gate';
import { todayIn } from '@/lib/leave';
import { clock, MBG_READERS } from '@/lib/mbg';
import { savedLabel } from '@/lib/offline-queue';
import { RECAP_MANAGERS, percent, semesterLabel } from '@/lib/report';
import { clockOffset, groupToday, minutesOfDay, overdueText } from '@/lib/session-clock';
import { useSection } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';
import { LeaveSection } from './leave-section';

const t = messages.board;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

const longDate = (date: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const dayName = (iso: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const dotted = (hhmm: string) => hhmm.replace(':', '.');

/**
 * "Hari ini" for admin, kepala sekolah and wakasek (U6a): the arrival board. Every part asks for its own data and shows its own four
 * states, so a slow part never holds back the others. Numbers come from the API as they are; nothing here works out a rekap.
 * Missing in the API (hidden, not faked): "Ingatkan" for a session, "Unduh rekap hari ini" (exports are per semester).
 */
export default function DasborPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const allowed = hasRole(...DASHBOARD_READERS);
  const timezone = me.schools.find((x) => x.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const mbgOn = useCapability('mbg.enabled');
  const gateOn = useCapability('gate.enabled');
  const ready = Boolean(schoolId) && allowed;
  const key = schoolId ?? '';
  const today = todayIn(timezone);
  /** Server time minus the phone's clock, from the Date header of the sessions answer (same stand-in as /hari-ini). */
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [foundation, setFoundation] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!ready) return;
    // The yayasan link only shows for people who lead schools of a collection.
    api('/dashboard/collections', CollectionDashboardList)
      .then((r) => setFoundation(r.items.length > 0))
      .catch(() => undefined);
  }, [ready]);

  const principal = useSection(`${key}:principal`, ready ? async () => {
    const d = await api('/dashboard/principal', PrincipalDashboard, { schoolId });
    setLoadedAt(Date.now());
    return d;
  } : null);
  const semesters = useSection(`${key}:semesters`, ready ? () => api('/reports/semesters', ReportSemesterList, { schoolId }) : null);
  const sessions = useSection(`${key}:sessions`, ready ? () => api('/attendance/today?scope=all', TodayResponse, {
    schoolId,
    onResponse: (res) => {
      const o = clockOffset(res.headers.get('date'), Date.now());
      if (o !== null) setOffset(o);
    },
  }) : null);
  const leave = useSection(`${key}:leave`, ready ? () => api('/leave-requests?status=pending', LeaveRequestList, { schoolId }) : null, (d) => d.items.length === 0);
  const classes = useSection(`${key}:classes:${today}`, ready ? () => api(`/reports/attendance/classes?from=${today}&to=${today}`, ClassRecapList, { schoolId }) : null, (d) => d.items.length === 0);
  const mbg = useSection(`${key}:mbg`, ready && mbgOn && hasRole(...MBG_READERS) ? async () => {
    const [daily, forecast] = await Promise.all([api('/mbg/daily', MbgDaily, { schoolId }), api('/mbg/forecast', MbgForecast, { schoolId })]);
    return { daily, forecast };
  } : null);

  const nowMinutes = minutesOfDay(new Date(tick + offset), timezone);
  const late = sessions.data ? groupToday(sessions.data.sessions, nowMinutes).unfilled : [];
  const sessionsState = sessions.state === 'ready' && late.length === 0 ? 'empty' : sessions.state;

  if (!allowed) {
    return (
      <PageMain>
        <h1 className="m-0 text-h1">{t.title}</h1>
        <p role="alert" className="m-0 text-body">
          {t.forbidden}
        </p>
      </PageMain>
    );
  }

  const semester = semesters.data?.items.find((s) => s.startsOn <= today && today <= s.endsOn);
  const subtitle = [longDate(today), semester ? semesterLabel(semester).toLowerCase() : null, loadedAt ? fill(t.updated, { time: savedLabel(new Date(loadedAt).toISOString(), timezone) }) : null].filter(Boolean).join(' · ');

  const todayCounts = principal.data?.attendance.today;
  const pendingLeave = leave.data?.items.length;
  const boxes: StatusBoxData[] | null = todayCounts
    ? [
        { code: 'H', count: todayCounts.counts.H, ...captionOf(presentCaption(todayCounts, percent) ?? (todayCounts.days === 0 ? t.noRecapYet : undefined)) },
        { code: 'T', count: todayCounts.counts.T },
        { code: 'I', count: todayCounts.counts.I, ...captionOf(pendingLeave ? fill(t.pendingLeave, { n: pendingLeave }) : undefined) },
        { code: 'S', count: todayCounts.counts.S },
        { code: 'A', count: todayCounts.counts.A },
      ]
    : null;

  const classBars: BarItem[] = (classes.data?.items ?? []).map((c) => ({
    key: c.id,
    label: c.name,
    value: c.presentRate,
    text: percent(c.presentRate),
    ...(c.counts.A > 0 ? { flag: `A ${c.counts.A}` } : {}),
    name: c.presentRate === null ? `${c.name}: belum ada presensi` : `${c.name}: ${percent(c.presentRate)} hadir${c.counts.A > 0 ? `, ${c.counts.A} alpa` : ''}`,
  }));
  const trendBars: BarItem[] = (principal.data?.attendance.trend ?? []).map((p) => ({
    key: p.date,
    label: shortDate(p.date),
    value: p.presentRate,
    text: percent(p.presentRate),
    name: `Kehadiran ${shortDate(p.date)}: ${percent(p.presentRate)}`,
  }));
  const atRisk = principal.data?.atRisk;
  const showMbg = Boolean(mbgOn) && hasRole(...MBG_READERS);

  return (
    <PageMain width="xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-h1">{t.title}</h1>
          <p className="m-0 text-body text-tinta-muted">{subtitle}</p>
        </div>
        <nav aria-label="Pintasan" className="flex flex-wrap gap-2">
          {gateOn && hasRole(...GATE_VIEWERS) && (
            <Link href="/gerbang/papan" className={cx(buttonStyles({ variant: 'secondary', size: '48' }), 'no-underline')}>
              {t.gate}
            </Link>
          )}
          {hasRole(...RECAP_MANAGERS) && (
            <Link href="/rekap" className={cx(buttonStyles({ variant: 'secondary', size: '48' }), 'no-underline')}>
              {t.recap}
            </Link>
          )}
          {foundation && (
            <Link href="/dasbor/yayasan" className={cx(buttonStyles({ variant: 'secondary', size: '48' }), 'no-underline')}>
              {t.foundation}
            </Link>
          )}
        </nav>
      </header>

      {boxes ? (
        <StatusBoard items={boxes} />
      ) : (
        <BoardSection title={t.summaryLabel} state={principal.state === 'ready' ? 'empty' : principal.state} emptyText={t.noRecapYet} onRetry={principal.reload} />
      )}

      <div className={cx('grid grid-cols-1 gap-4', showMbg && 'lg:grid-cols-[2fr_1fr]')}>
        <BoardSection title={t.sessionsTitle} aside={[late.length > 0 ? fill(t.sessionsCount, { n: late.length }) : null, principal.data ? sessionsLine(principal.data.sessions) : null].filter(Boolean).join(' · ') || undefined} state={sessionsState} emptyText={t.sessionsEmpty} onRetry={sessions.reload}>
          <Table caption={t.sessionsTable} className="min-w-160">
            <TableHead>
              <TableRow>
                <Th>{t.colTime}</Th>
                <Th>{t.colClass}</Th>
                <Th>{t.colSubject}</Th>
                <Th>{t.colTeacher}</Th>
                <Th>{t.colLate}</Th>
                <Th>{t.colAction}</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {late.map((s) => (
                <TableRow key={s.id}>
                  <Td>
                    <span className="flex flex-col">
                      <span className="text-body-strong">{s.period ? `Jam ke-${s.period.number}` : '–'}</span>
                      {s.period && <span className="whitespace-nowrap text-small text-tinta-muted">{`${dotted(s.period.startsAt)}–${dotted(s.period.endsAt)}`}</span>}
                    </span>
                  </Td>
                  <Td>{s.owner.name}</Td>
                  <Td>{s.subject?.name ?? '–'}</Td>
                  <Td>{s.teacher?.name ?? t.noTeacher}</Td>
                  <Td className="whitespace-nowrap">{s.period ? (overdueText(s.period.endsAt, nowMinutes) ?? '–') : '–'}</Td>
                  <Td>
                    <Link href={`/sesi/${s.id}`} aria-label={`${t.open} ${s.owner.name}${s.subject ? ` · ${s.subject.name}` : ''}`} className="text-body-strong text-papan">
                      {t.open}
                    </Link>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="m-0 text-small text-tinta-muted">
            {t.sessionsNote}
          </p>
        </BoardSection>

        {showMbg && (
          <BoardSection
            title={t.mbgTitle}
            aside={mbg.data ? fill(t.mbgCutoff, { time: clock(mbg.data.daily.cutoffTime) }) : undefined}
            state={mbg.state}
            onRetry={mbg.reload}
            action={
              <Link href="/mbg" className="text-body-strong text-papan">
                {t.mbgMore}
              </Link>
            }
          >
            {mbg.data?.daily.status === 'not_school_day' ? (
              <p className="m-0 text-body">{t.mbgNotSchoolDay}</p>
            ) : (
              mbg.data && (
                <dl className="m-0 flex flex-col gap-3">
                  <div className="flex flex-col">
                    <dt className="text-small text-tinta-muted">{t.mbgToday}</dt>
                    <dd className="m-0 text-h1 tabular-nums">{mbg.data.daily.total.present}</dd>
                    <dd className="m-0 text-small text-tinta-muted">{mbgLine({ status: mbg.data.daily.status, enrolled: mbg.data.daily.total.enrolled, present: mbg.data.daily.total.present, unrecorded: mbg.data.daily.total.unrecorded })}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-small text-tinta-muted">{fill(mbg.data.forecast.status === 'computed' ? t.mbgForecast : t.mbgForecastPending, { date: dayName(mbg.data.forecast.date) })}</dt>
                    {mbg.data.forecast.status === 'computed' && <dd className="m-0 text-h2 tabular-nums">{mbg.data.forecast.total}</dd>}
                  </div>
                </dl>
              )
            )}
          </BoardSection>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {atRisk !== null && (
          <BoardSection
            title={t.attentionTitle}
            aside={t.attentionAside}
            state={principal.state === 'ready' && atRisk?.items.length === 0 ? 'empty' : principal.state}
            emptyText={t.attentionEmpty}
            onRetry={principal.reload}
          >
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {atRisk?.items.map((s) => (
                <AlertRow
                  key={s.enrollmentId}
                  code={warningCode(s.kinds)}
                  title={`${s.name} · ${s.className}`}
                  detail={`${kindsLine(s.kinds)} · terakhir ${shortDate(s.lastDate)}`}
                  actions={
                    <Link href="/peringatan-dini" className="text-body-strong text-papan">
                      {t.attentionDetail}
                    </Link>
                  }
                />
              ))}
            </ul>
            {atRisk && atRisk.students > atRisk.items.length && (
              <Link href="/peringatan-dini" className="text-body-strong text-papan">
                {fill(t.attentionAll, { n: atRisk.students })}
              </Link>
            )}
          </BoardSection>
        )}
        <LeaveSection section={leave} onDecided={principal.reload} />
      </div>

      <BoardSection title={t.classesTitle} aside={t.classesAside} state={classes.state} emptyText={t.classesEmpty} onRetry={classes.reload}>
        <BarList label={t.classesTitle} items={classBars} />
      </BoardSection>

      <BoardSection
        title={fill(t.trendTitle, { n: trendBars.length })}
        state={principal.state === 'ready' && trendBars.length === 0 ? 'empty' : principal.state}
        emptyText={t.trendEmpty}
        onRetry={principal.reload}
      >
        <BarList label={fill(t.trendTitle, { n: trendBars.length })} items={trendBars} />
      </BoardSection>
    </PageMain>
  );
}

const captionOf = (caption: string | undefined) => (caption ? { caption } : {});
