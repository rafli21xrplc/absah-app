'use client';

import { ClassRecapList, CollectionDashboardList, LeaveRequestList, MbgDaily, MbgForecast, PrincipalDashboard, ReportSemesterList, TodayResponse } from '@absah/contracts';
import { AlertRow, Badge, BarList, BoardSection, buttonStyles, CompositionBar, cx, DataCard, messages, PageMain, Pagination, PersonCell, SearchBox, StackedBars, StatCard, Table, TableBody, TableHead, TableRow, TaskRow, Td, Th, usePaged, type BarItem, type StackedBar } from '@absah/ui';
import { CircleAlert, ClipboardCheck, ClipboardList, Clock, FileText, School, ShieldAlert, TrendingUp, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { DASHBOARD_READERS, kindsLine, sessionsLine, warningCode } from '@/lib/dashboard';
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
  const [allClasses, setAllClasses] = useState(false);

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
  const lateQuery = useLateFilter(late);

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
  const pendingLeave = leave.data?.items.length ?? 0;
  const trend = principal.data?.attendance.trend ?? [];
  // "vs kemarin": today's present against the previous school date with a rekap, when today has one.
  const last = trend.at(-1);
  const before = trend.at(-2);
  const delta = last && before && last.date === today ? last.present - before.present : null;
  const fillRate = principal.data?.sessions;
  const classItems = classes.data?.items ?? [];
  const bar = (c: (typeof classItems)[number]): BarItem => ({
    key: c.id,
    label: c.name,
    value: c.presentRate,
    text: percent(c.presentRate),
    ...(c.counts.A > 0 ? { flag: `A ${c.counts.A}` } : {}),
    name: c.presentRate === null ? `${c.name}: belum ada presensi` : `${c.name}: ${percent(c.presentRate)} hadir${c.counts.A > 0 ? `, ${c.counts.A} alpa` : ''}`,
  });
  // Lowest first; rombel without any presensi yet go last (they are not "low", they are not filled).
  const ranked = [...classItems].sort((x, y) => (x.presentRate ?? 2) - (y.presentRate ?? 2) || y.counts.A - x.counts.A);
  const shownClasses = (allClasses ? ranked : ranked.slice(0, CLASS_PREVIEW)).map(bar);
  const unrecordedClasses = classItems.filter((c) => c.presentRate === null).length;
  const trendBars: StackedBar[] = trend.map((p) => ({
    key: p.date,
    label: shortDate(p.date),
    segments: [
      { value: p.present, fill: 'bg-papan', label: t.trendPresent },
      { value: p.days - p.present, fill: 'bg-alpa-soft', label: t.trendAbsent },
    ],
  }));
  // Who to chase: teachers with the most sessions past their time and still empty (from the same list as the table).
  const byTeacher = [...late.reduce((m, s) => m.set(s.teacher?.name ?? t.noTeacher, (m.get(s.teacher?.name ?? t.noTeacher) ?? 0) + 1), new Map<string, number>())]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5);
  const atRisk = principal.data?.atRisk;
  const showMbg = Boolean(mbgOn) && hasRole(...MBG_READERS);
  const linkCls = 'shrink-0 text-small font-bold text-papan';

  return (
    <PageMain width="xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-h1">{t.title}</h1>
          <p className="m-0 text-small text-tinta-muted">{subtitle}</p>
        </div>
        <nav aria-label="Pintasan" className="flex flex-wrap gap-2">
          {gateOn && hasRole(...GATE_VIEWERS) && (
            <Link href="/gerbang/papan" className={cx(buttonStyles({ variant: 'secondary' }), 'no-underline')}>
              {t.gate}
            </Link>
          )}
          {foundation && (
            <Link href="/dasbor/yayasan" className={cx(buttonStyles({ variant: 'secondary' }), 'no-underline')}>
              {t.foundation}
            </Link>
          )}
          {hasRole(...RECAP_MANAGERS) && (
            <Link href="/rekap" className={cx(buttonStyles({ variant: 'primary' }), 'no-underline')}>
              {t.recap}
            </Link>
          )}
        </nav>
      </header>

      {todayCounts ? (
        <ul aria-label={t.summaryLabel} className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 xl:grid-cols-5">
          <li className="col-span-2 flex md:col-span-1">
            <StatCard
              className="flex-1"
              title={t.cardRate}
              tone="hadir"
              icon={TrendingUp}
              value={percent(todayCounts.presentRate)}
              meter={todayCounts.presentRate}
              {...(delta !== null ? { delta: { text: `${delta > 0 ? '+' : ''}${delta}`, label: t.vsYesterday } } : {})}
              note={todayCounts.days === 0 ? t.noRecapYet : fill(t.rateNote, { n: todayCounts.counts.H + todayCounts.counts.T, total: todayCounts.days })}
            />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.late} tone="telat" icon={Clock} value={todayCounts.counts.T} unit={t.students} parts={[{ value: todayCounts.counts.H, label: t.onTimeLower }]} />
          </li>
          <li className="flex">
            <StatCard
              className="flex-1"
              title={t.cardExcused}
              tone="izin"
              icon={FileText}
              value={todayCounts.counts.I + todayCounts.counts.S}
              unit={t.students}
              parts={[
                { value: todayCounts.counts.I, label: 'izin' },
                { value: todayCounts.counts.S, label: 'sakit' },
              ]}
            />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.cardAbsent} tone="alpa" icon={CircleAlert} value={todayCounts.counts.A} unit={t.students} note={t.absentNote} />
          </li>
          <li className="flex">
            <StatCard
              className="flex-1"
              title={t.cardSessions}
              tone="papan"
              icon={ClipboardCheck}
              value={fillRate ? `${fillRate.filled}/${fillRate.total}` : '–'}
              meter={fillRate?.fillRate ?? null}
              {...(fillRate ? { parts: [{ value: late.length, label: t.lateSessions }, { value: fillRate.missed, label: t.missedLower }] } : {})}
            />
          </li>
        </ul>
      ) : (
        <BoardSection title={t.summaryLabel} state={principal.state === 'ready' ? 'empty' : principal.state} emptyText={t.noRecapYet} onRetry={principal.reload} />
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <DataCard title={t.compositionTitle} aside={todayCounts ? fill(t.compositionAside, { n: todayCounts.days }) : undefined}>
          {todayCounts && todayCounts.days > 0 ? (
            <CompositionBar
              label={t.compositionTitle}
              items={[
                { key: 'H', code: 'H', label: 'Hadir', value: todayCounts.counts.H, tone: 'hadir' },
                { key: 'T', code: 'T', label: 'Telat', value: todayCounts.counts.T, tone: 'telat' },
                { key: 'I', code: 'I', label: 'Izin', value: todayCounts.counts.I, tone: 'izin' },
                { key: 'S', code: 'S', label: 'Sakit', value: todayCounts.counts.S, tone: 'sakit' },
                { key: 'A', code: 'A', label: 'Alpa', value: todayCounts.counts.A, tone: 'alpa' },
              ]}
            />
          ) : (
            <p className="m-0 text-body text-tinta-muted">{principal.state === 'ready' ? t.noRecapYet : t.loading}</p>
          )}
          {trendBars.length >= 2 && (
            <div className="flex flex-col gap-2 border-t border-garis pt-3">
              <h3 className="m-0 text-small font-semibold text-tinta-muted">{fill(t.trendTitle, { n: trendBars.length })}</h3>
              <StackedBars compact title={fill(t.trendTitle, { n: trendBars.length })} bars={trendBars} legend={[{ label: t.trendPresent, fill: 'bg-papan' }, { label: t.trendAbsent, fill: 'bg-alpa-soft' }]} />
            </div>
          )}
        </DataCard>
        <div id="sesi-belum-diisi" className="flex min-w-0 flex-col">
          {sessionsState === 'ready' ? (
            <DataCard
              title={t.sessionsTitle}
              aside={[fill(t.sessionsCount, { n: late.length }), principal.data ? sessionsLine(principal.data.sessions) : null].filter(Boolean).join(' · ')}
              toolbar={<SearchBox label={t.sessionsSearch} value={lateQuery.query} onChange={lateQuery.setQuery} className="w-64" />}
              footer={<Pagination page={lateQuery.paged.page} pageCount={lateQuery.paged.pageCount} total={lateQuery.paged.total} size={PAGE} onPage={lateQuery.paged.setPage} />}
            >
              <Table bare dense caption={t.sessionsTable} className="min-w-140">
                <TableHead>
                  <TableRow>
                    <Th>{t.colTime}</Th>
                    <Th>{t.colClassSubject}</Th>
                    <Th>{t.colTeacher}</Th>
                    <Th>{t.colLate}</Th>
                    <Th>
                      <span className="sr-only">{t.colAction}</span>
                    </Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lateQuery.paged.slice.map((s) => (
                    <TableRow key={s.id}>
                      <Td className="whitespace-nowrap">
                        <span className="text-body-strong">{s.period ? `Jam ${s.period.number}` : '–'}</span>
                        {s.period && <span className="block text-small text-tinta-muted">{`${dotted(s.period.startsAt)}–${dotted(s.period.endsAt)}`}</span>}
                      </Td>
                      <Td>
                        <span className="text-body-strong">{s.owner.name}</span>
                        <span className="block text-small text-tinta-muted">{s.subject?.name ?? '–'}</span>
                      </Td>
                      <Td>{s.teacher?.name ?? t.noTeacher}</Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone="telat">{s.period ? (overdueText(s.period.endsAt, nowMinutes) ?? '–') : '–'}</Badge>
                      </Td>
                      <Td className="text-right">
                        <Link href={`/sesi/${s.id}`} aria-label={`${t.open} ${s.owner.name}${s.subject ? ` · ${s.subject.name}` : ''}`} className="text-body-strong text-papan">
                          {t.open}
                        </Link>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="m-0 text-small text-tinta-muted">{t.sessionsNote}</p>
            </DataCard>
          ) : (
            <BoardSection title={t.sessionsTitle} aside={principal.data ? sessionsLine(principal.data.sessions) : undefined} state={sessionsState} emptyText={t.sessionsEmpty} onRetry={sessions.reload} />
          )}
        </div>
        </div>
        <div className="order-first flex min-w-0 flex-col gap-4 lg:order-none">
        <DataCard title={t.tasksTitle}>
          <ul aria-label={t.tasksTitle} className="m-0 flex list-none flex-col p-0">
            <TaskRow
              tone="telat"
              icon={ClipboardList}
              title={t.taskSessions}
              detail={late.length > 0 ? t.taskSessionsDetail : t.taskNone}
              count={late.length}
              {...(late.length > 0 ? { action: <a href="#sesi-belum-diisi" className={linkCls}>{t.see}</a> } : {})}
            />
            <TaskRow
              tone="izin"
              icon={FileText}
              title={t.taskLeave}
              detail={pendingLeave > 0 ? t.taskLeaveDetail : t.taskNone}
              count={leave.state === 'ready' || leave.state === 'empty' ? pendingLeave : '–'}
              action={<Link href="/izin" className={linkCls}>{t.see}</Link>}
            />
            {atRisk !== null && (
              <TaskRow
                tone="alpa"
                icon={ShieldAlert}
                title={t.taskRisk}
                detail={atRisk && atRisk.students > 0 ? t.taskRiskDetail : t.taskNone}
                count={atRisk?.students ?? '–'}
                action={<Link href="/peringatan-dini" className={linkCls}>{t.see}</Link>}
              />
            )}
            <TaskRow
              tone="netral"
              icon={School}
              title={t.taskUnrecorded}
              detail={unrecordedClasses > 0 ? t.taskUnrecordedDetail : t.taskNone}
              count={classes.state === 'ready' || classes.state === 'empty' ? unrecordedClasses : '–'}
            />
            {showMbg && (
              <TaskRow
                tone="papan"
                icon={UtensilsCrossed}
                title={t.mbgToday}
                detail={mbg.data ? (mbg.data.daily.status === 'not_school_day' ? t.mbgNotSchoolDay : fill(t.mbgCutoff, { time: clock(mbg.data.daily.cutoffTime) })) : t.loading}
                count={mbg.data && mbg.data.daily.status !== 'not_school_day' ? mbg.data.daily.total.present : '–'}
                action={<Link href="/mbg" className={linkCls}>{t.see}</Link>}
              />
            )}
          </ul>
        </DataCard>
          <BoardSection title={t.classesTitle} aside={allClasses ? t.classesAside : t.classesLowest} state={classes.state} emptyText={t.classesEmpty} onRetry={classes.reload}>
            <BarList dense columns={1} label={t.classesTitle} items={shownClasses} />
            {ranked.length > CLASS_PREVIEW && (
              <button type="button" onClick={() => setAllClasses((v) => !v)} aria-expanded={allClasses} className="cursor-pointer self-start border-0 bg-transparent p-0 text-small font-bold text-papan">
                {allClasses ? t.classesFewer : fill(t.classesAll, { n: ranked.length })}
              </button>
            )}
          </BoardSection>
          {byTeacher.length > 0 && (
            <DataCard title={t.teachersTitle}>
              <ul aria-label={t.teachersTitle} className="m-0 flex list-none flex-col p-0">
                {byTeacher.map(([name, n]) => (
                  <li key={name} className="flex items-center justify-between gap-3 border-b border-garis py-2 last:border-b-0">
                    <PersonCell name={name} />
                    <Badge tone="telat">{fill(t.sessionsCount, { n })}</Badge>
                  </li>
                ))}
              </ul>
            </DataCard>
          )}
        </div>
      </div>

      {(pendingLeave > 0 || leave.state === 'error' || leave.state === 'offline' || (atRisk && atRisk.items.length > 0)) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {atRisk && atRisk.items.length > 0 && (
            <BoardSection title={t.attentionTitle} aside={t.attentionAside} state={principal.state} emptyText={t.attentionEmpty} onRetry={principal.reload}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {atRisk.items.map((s) => (
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
              {atRisk.students > atRisk.items.length && (
                <Link href="/peringatan-dini" className="text-body-strong text-papan">
                  {fill(t.attentionAll, { n: atRisk.students })}
                </Link>
              )}
            </BoardSection>
          )}
          {(pendingLeave > 0 || leave.state === 'error' || leave.state === 'offline') && <LeaveSection section={leave} onDecided={principal.reload} />}
        </div>
      )}
    </PageMain>
  );
}

const CLASS_PREVIEW = 6;
const PAGE = 10;

/** Search over the late sessions (rombel, mapel, guru) and pages of ten. */
function useLateFilter<T extends { owner: { name: string }; subject: { name: string } | null; teacher: { name: string } | null }>(items: T[]) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? items.filter((s) => [s.owner.name, s.subject?.name, s.teacher?.name].some((v) => v?.toLowerCase().includes(q))) : items),
    [items, q],
  );
  const paged = usePaged(shown, PAGE);
  return { query, setQuery, paged };
}
