'use client';

import { ClassRecapList, CollectionDashboardList, LeaveRequestList, MbgDaily, MbgForecast, PrincipalDashboard, ReportSemesterList, TodayResponse } from '@absah/contracts';
import {
  Avatar,
  BoardSection,
  Button,
  buttonStyles,
  Chip,
  cx,
  HeroRingCard,
  ListCardList,
  ListCardRow,
  messages,
  PageHeader,
  PageMain,
  Pagination,
  percentText,
  ProgressBar,
  SearchBox,
  StackBar,
  StatGroupCard,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  TrendBarChart,
  usePaged,
  type TrendPoint,
} from '@absah/ui';
import { AlertTriangle, CheckCircle2, Clock, Download, Monitor } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { DASHBOARD_READERS, kindsLine, sessionsLine, warningCode } from '@/lib/dashboard';
import { GATE_VIEWERS } from '@/lib/gate';
import { todayIn } from '@/lib/leave';
import { clock, MBG_READERS } from '@/lib/mbg';
import { savedLabel } from '@/lib/offline-queue';
import { RECAP_MANAGERS, semesterLabel } from '@/lib/report';
import { clockOffset, groupToday, minutesOfDay, overdueText } from '@/lib/session-clock';
import { useSection } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';
import { LeaveSection } from './leave-section';

const t = messages.board;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
const nf = (n: number) => n.toLocaleString('id-ID');

const longDate = (date: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const monthYear = (iso: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const dayNumber = (iso: string) => String(Number(iso.slice(8, 10)));
const dotted = (hhmm: string) => hhmm.replace(':', '.');

/**
 * "Hari ini" for admin, kepala sekolah and wakasek (U6a, v3 layout in V4). Order follows the Hari-ini-v3 board: hero and the two
 * group cards, trend and rombel, then the action lists (sessions, izin) beside the side column (MBG, perlu perhatian, guru).
 * Every part asks for its own data and shows its own four states. Numbers come from the API as they are.
 *
 * Hidden until the API sends them (TODO(api), listed in docs/ui-v3-audit.md): deltas per status, arrival histogram, pulang awal,
 * per tingkat, activity feed, school target and bell, "Ingatkan", "Unduh rekap hari ini".
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
  const showMbg = Boolean(mbgOn) && hasRole(...MBG_READERS);
  const mbg = useSection(`${key}:mbg`, ready && showMbg ? async () => {
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
  const updated = [loadedAt ? fill(t.updated, { time: savedLabel(new Date(loadedAt).toISOString(), timezone) }) : null, semester ? semesterLabel(semester).toLowerCase() : null]
    .filter(Boolean)
    .join(' · ');

  const todayCounts = principal.data?.attendance.today;
  const counts = todayCounts?.counts;
  const pendingLeave = leave.data?.items.length ?? 0;
  const trend = principal.data?.attendance.trend ?? [];
  const rates = trend.filter((p): p is typeof p & { presentRate: number } => p.presentRate !== null);
  // Change against the previous school date with a rekap, only when today has one. Points of a percentage, from the API's rates.
  const lastRate = rates.at(-1);
  const prevRate = rates.at(-2);
  const rateDelta = lastRate && prevRate && lastRate.date === today ? Math.round((lastRate.presentRate - prevRate.presentRate) * 1000) / 10 : null;
  const trendPoints: TrendPoint[] = trend.map((p) => ({ label: dayNumber(p.date), title: shortDate(p.date), value: p.presentRate }));
  const lowest = rates.length > 0 ? Math.min(...rates.map((r) => r.presentRate)) : 1;
  // The 90-100 axis only while every day is above 90%; otherwise the axis starts at the tenth below, never clipping a bar.
  const axisMin = lowest >= 0.9 ? 0.9 : Math.max(0, Math.floor(lowest * 10) / 10);

  const classItems = classes.data?.items ?? [];
  // Lowest first; rombel without any presensi yet go last (they are not "low", they are not filled).
  const ranked = [...classItems].sort((x, y) => (x.presentRate ?? 2) - (y.presentRate ?? 2) || y.counts.A - x.counts.A);
  const shownClasses = allClasses ? ranked : ranked.slice(0, CLASS_PREVIEW);
  const mostAbsent = [...classItems].filter((c) => c.counts.A > 0).sort((x, y) => y.counts.A - x.counts.A).slice(0, 3);
  const mostLate = [...classItems].filter((c) => c.counts.T > 0).sort((x, y) => y.counts.T - x.counts.T).slice(0, 3);
  // No trend yet (fewer than two school days with a rekap): the card is left out and the rombel list takes the row.
  const trendHidden = principal.state === 'ready' && rates.length < 2;
  // Who to chase: teachers with the most sessions past their time and still empty (from the same list as the table).
  const byTeacher = [...late.reduce((m, s) => m.set(s.teacher?.name ?? t.noTeacher, (m.get(s.teacher?.name ?? t.noTeacher) ?? 0) + 1), new Map<string, number>())]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5);
  const atRisk = principal.data?.atRisk;
  const absent = counts ? counts.I + counts.S + counts.A : 0;

  return (
    <PageMain width="full">
      <PageHeader
        title={t.title}
        date={{ label: longDate(today) }}
        {...(updated ? { updated: updated.charAt(0).toUpperCase() + updated.slice(1) } : {})}
        actions={
          <>
            {foundation && (
              <Link href="/dasbor/yayasan" className={cx(buttonStyles({ variant: 'outline' }), 'no-underline')}>
                {t.foundation}
              </Link>
            )}
            {gateOn && hasRole(...GATE_VIEWERS) && (
              <Link href="/gerbang/papan" className={cx(buttonStyles({ variant: 'outline' }), 'no-underline')}>
                <Monitor aria-hidden strokeWidth={1.75} className="size-4" />
                {t.gate}
              </Link>
            )}
            {hasRole(...RECAP_MANAGERS) && (
              <Link href="/rekap" className={cx(buttonStyles({ variant: 'primary' }), 'no-underline')}>
                <Download aria-hidden strokeWidth={1.75} className="size-4" />
                {t.recap}
              </Link>
            )}
          </>
        }
      />

      {/* Row 1: hero + two group cards. Under 1280 px the hero takes its own row. */}
      {todayCounts && counts && todayCounts.days > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(17rem,20rem)_1fr_1fr]">
          <div className="flex md:col-span-2 xl:col-span-1">
            <div className="flex w-full flex-col [&>section]:flex-1">
              <HeroRingCard
                title={t.cardRate}
                badge={fill(t.heroBadge, { n: nf(todayCounts.days) })}
                rate={todayCounts.presentRate ?? 0}
                value={nf(counts.H)}
                lines={[fill(t.heroOnTime, { n: nf(todayCounts.days) }), fill(t.heroRest, { late: nf(counts.T), absent: nf(absent) })]}
                {...(rates.length >= 2 ? { spark: rates.map((r) => r.presentRate), sparkLabel: fill(t.trendSpark, { n: rates.length }) } : {})}
                parts={[
                  { label: t.shareOnTime, value: percentText(counts.H / todayCounts.days) },
                  { label: t.shareLate, value: percentText(counts.T / todayCounts.days) },
                  { label: t.shareAbsent, value: percentText(absent / todayCounts.days) },
                ]}
                {...(rateDelta !== null
                  ? { note: rateDelta === 0 ? t.heroSame : fill(rateDelta > 0 ? t.heroUp : t.heroDown, { n: Math.abs(rateDelta).toLocaleString('id-ID') }) }
                  : {})}
              />
            </div>
          </div>
          <StatGroupCard
            title={t.arrivalTitle}
            icon={CheckCircle2}
            stats={[
              { label: t.cardPresent, value: counts.H, dot: 'hadir' },
              { label: t.late, value: counts.T, dot: 'telat' },
              { label: t.arrivalRecorded, value: todayCounts.days, dot: 'muted' },
            ]}
            bar={
              <StackBar
                label={t.arrivalTitle}
                parts={[
                  { value: counts.H, label: t.cardPresent, tone: 'hadir' },
                  { value: counts.T, label: t.late, tone: 'telat' },
                  { value: absent, label: t.absentTitle, tone: 'muted' },
                ]}
              />
            }
            footer={fill(t.arrivalAtSchool, { n: nf(counts.H + counts.T) })}
            footerEnd={fill(t.arrivalLateShare, { pct: percentText(counts.T / todayCounts.days) })}
          >
            {mostLate.length > 0 && <TopClasses title={t.lateTopTitle} tone="telat" items={mostLate.map((c) => ({ id: c.id, name: c.name, text: fill(t.lateTop, { n: c.counts.T }) }))} />}
          </StatGroupCard>
          <StatGroupCard
            title={t.absentTitle}
            icon={AlertTriangle}
            iconTone="alpa"
            stats={[
              { label: 'Izin', value: counts.I, dot: 'izin' },
              { label: 'Sakit', value: counts.S, dot: 'sakit' },
              { label: 'Alpa', value: counts.A, dot: 'alpa' },
            ]}
            bar={
              <StackBar
                label={t.absentTitle}
                parts={[
                  { value: counts.I, label: 'Izin', tone: 'izin' },
                  { value: counts.S, label: 'Sakit', tone: 'sakit' },
                  { value: counts.A, label: 'Alpa', tone: 'alpa' },
                ]}
              />
            }
            footer={fill(t.absentTotal, { n: nf(absent) })}
            footerEnd={
              pendingLeave > 0 ? (
                <Link href="/izin" className="font-semibold text-on-stabilo-soft">
                  {fill(t.absentWaiting, { n: pendingLeave })}
                </Link>
              ) : undefined
            }
          >
            {mostAbsent.length > 0 && <TopClasses title={t.absentTopTitle} tone="alpa" items={mostAbsent.map((c) => ({ id: c.id, name: c.name, text: fill(t.absentTop, { n: c.counts.A }) }))} />}
          </StatGroupCard>
        </div>
      ) : (
        <BoardSection title={t.summaryLabel} state={principal.state === 'ready' ? 'empty' : principal.state} emptyText={t.noRecapYet} onRetry={principal.reload} />
      )}

      {/* Row 2: trend + rombel. */}
      <div className={cx('grid grid-cols-1 gap-4', !trendHidden && 'xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}>
        {!trendHidden && (
        <BoardSection
          title={t.trendCardTitle}
          subtitle={t.trendCardSubtitle}
          state={principal.state === 'ready' && rates.length < 2 ? 'empty' : principal.state}
          emptyText={t.trendOne}
          onRetry={principal.reload}
        >
          <TrendBarChart data={trendPoints} min={axisMin} {...(trend[0] ? { caption: monthYear(trend[0].date) } : {})} />
        </BoardSection>
        )}
        <BoardSection title={t.classesV3Title} subtitle={t.classesV3Subtitle} state={classes.state} emptyText={t.classesEmpty} onRetry={classes.reload}>
          <ul aria-label={t.classesV3Title} className={cx('m-0 grid list-none grid-cols-1 gap-2 p-0', trendHidden && 'lg:grid-cols-2 2xl:grid-cols-3')}>
            {shownClasses.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-ubin bg-ubin px-3 py-2">
                <Chip tone="papan" square className="min-w-14 justify-center">
                  {c.name}
                </Chip>
                <span className="min-w-0 flex-1 truncate text-small text-tinta-muted">{c.homeroom ? fill(t.homeroom, { name: c.homeroom.name }) : '–'}</span>
                {c.presentRate === null ? (
                  <span className="text-small text-tinta-muted">{t.notRecorded}</span>
                ) : (
                  <>
                    <ProgressBar bare label={c.name} value={Math.round(c.presentRate * 1000)} max={1000} text={percentText(c.presentRate)} className="hidden w-24 sm:flex" />
                    <span className={cx('w-14 text-right text-isi-strong tabular-nums', c.counts.A > 0 ? 'text-alpa' : 'text-tinta')}>{percentText(c.presentRate)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          {ranked.length > CLASS_PREVIEW && (
            <button type="button" onClick={() => setAllClasses((v) => !v)} aria-expanded={allClasses} className="cursor-pointer self-start border-0 bg-transparent p-0 text-small font-bold text-papan">
              {allClasses ? t.classesFewer : fill(t.classesAll, { n: ranked.length })}
            </button>
          )}
        </BoardSection>
      </div>

      {/* Row 3: action lists left, side column right. */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div id="sesi-belum-diisi" className="flex min-w-0 flex-col">
            <BoardSection
              title={t.sessionsTitle}
              subtitle={principal.data ? `${t.sessionsSubtitle} · ${sessionsLine(principal.data.sessions)}` : t.sessionsSubtitle}
              {...(late.length > 0 ? { count: fill(t.sessionsCount, { n: late.length }) } : {})}
              state={sessionsState}
              emptyText={t.sessionsEmpty}
              onRetry={sessions.reload}
              action={<SearchBox label={t.sessionsSearch} value={lateQuery.query} onChange={lateQuery.setQuery} className="w-56" />}
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
                        <span className="text-isi-strong">{s.period ? `Jam ke-${s.period.number}` : '–'}</span>
                        {s.period && <span className="block text-mini text-tinta-muted">{`${dotted(s.period.startsAt)}–${dotted(s.period.endsAt)}`}</span>}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-2">
                          <Chip tone="papan" square>
                            {s.owner.name}
                          </Chip>
                          <span className="text-isi">{s.subject?.name ?? '–'}</span>
                        </span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          {s.teacher && <Avatar name={s.teacher.name} seed={s.teacher.name} size={30} />}
                          <span className="text-isi">{s.teacher?.name ?? t.noTeacher}</span>
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Chip tone="alpa" icon={Clock}>
                          {s.period ? (overdueText(s.period.endsAt, nowMinutes) ?? '–') : '–'}
                        </Chip>
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/sesi/${s.id}`}
                          aria-label={`${t.open} ${s.owner.name}${s.subject ? ` · ${s.subject.name}` : ''}`}
                          className={cx(buttonStyles({ variant: 'soft', size: '36' }), 'no-underline')}
                        >
                          {t.open}
                        </Link>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3">
                <Pagination page={lateQuery.paged.page} pageCount={lateQuery.paged.pageCount} total={lateQuery.paged.total} size={PAGE} onPage={lateQuery.paged.setPage} />
                <p className="m-0 rounded-ubin bg-ubin px-3 py-2 text-small text-tinta-muted">{t.sessionsNote}</p>
              </div>
            </BoardSection>
          </div>
          <LeaveSection section={leave} onDecided={principal.reload} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {showMbg && (
            <BoardSection
              title={t.mbgTitle}
              state={mbg.state}
              onRetry={mbg.reload}
              {...(mbg.data ? { count: fill(t.mbgCutoff, { time: clock(mbg.data.daily.cutoffTime) }) } : {})}
            >
              {mbg.data &&
                (mbg.data.daily.status === 'not_school_day' ? (
                  <p className="m-0 text-isi text-tinta-muted">{t.mbgNotSchoolDay}</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 rounded-ubin bg-papan-soft p-4">
                      <span className="text-small text-papan">{t.mbgPortions}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-angka-hero tabular-nums text-papan">{nf(mbg.data.daily.total.present)}</span>
                        <span className="text-isi text-papan">{t.mbgUnit}</span>
                      </span>
                      <ProgressBar bare label={t.mbgPortions} value={mbg.data.daily.total.present} max={Math.max(mbg.data.daily.total.enrolled, 1)} unit={t.students} />
                      <span className="text-small text-tinta">
                        {fill(t.mbgLine, {
                          n: nf(mbg.data.daily.total.present),
                          enrolled: nf(mbg.data.daily.total.enrolled),
                          status: mbg.data.daily.sentAt ? t.mbgSent : fill(t.mbgPending, { time: clock(mbg.data.daily.cutoffTime) }),
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
                      <span className="text-isi-strong">
                        {mbg.data.forecast.status === 'computed' ? fill(t.mbgForecast, { date: shortDate(mbg.data.forecast.date) }) : fill(t.mbgForecastPending, { date: shortDate(mbg.data.forecast.date) })}
                      </span>
                      {mbg.data.forecast.status === 'computed' && <span className="text-h2 tabular-nums">{nf(mbg.data.forecast.total)}</span>}
                    </div>
                    <Link href="/mbg" className="text-small font-semibold text-papan">
                      {t.mbgMore}
                    </Link>
                  </>
                ))}
            </BoardSection>
          )}
          {atRisk !== null && (
            <BoardSection
              title={t.attentionTitle}
              subtitle={t.attentionAside}
              {...(atRisk && atRisk.students > 0 ? { count: fill(t.attentionCount, { n: atRisk.students }) } : {})}
              state={principal.state === 'ready' && (!atRisk || atRisk.items.length === 0) ? 'empty' : principal.state}
              emptyText={t.attentionEmpty}
              onRetry={principal.reload}
            >
              <ListCardList label={t.attentionTitle}>
                {(atRisk?.items ?? []).map((s) => (
                  <ListCardRow
                    key={s.enrollmentId}
                    lead={<Avatar name={s.name} seed={s.enrollmentId} size={38} />}
                    title={s.name}
                    tags={
                      <>
                        <span className="text-small text-tinta-muted">{s.className}</span>
                        <Chip tone={warningCode(s.kinds) === 'A' ? 'alpa' : 'telat'}>{kindsLine(s.kinds)}</Chip>
                      </>
                    }
                    detail={fill(t.lastSeen, { date: shortDate(s.lastDate) })}
                    below={
                      <Link href="/peringatan-dini" className="text-small font-semibold text-papan">
                        {t.attentionDetail}
                      </Link>
                    }
                  />
                ))}
              </ListCardList>
              {atRisk && atRisk.students > atRisk.items.length && (
                <Link href="/peringatan-dini" className="text-small font-semibold text-papan">
                  {fill(t.attentionAll, { n: atRisk.students })}
                </Link>
              )}
            </BoardSection>
          )}
          {byTeacher.length > 0 && (
            <BoardSection title={t.teachersTitle} subtitle={t.teachersSubtitle} count={fill(t.sessionsCount, { n: late.length })} state="ready">
              <ListCardList label={t.teachersTitle}>
                {byTeacher.map(([name, n]) => (
                  <ListCardRow key={name} lead={<Avatar name={name} seed={name} size={36} />} title={name} end={<Chip tone="telat">{fill(t.sessionsCount, { n })}</Chip>} />
                ))}
              </ListCardList>
              <Button variant="ghost" size="40" className="self-start px-0" onClick={() => document.getElementById('sesi-belum-diisi')?.scrollIntoView()}>
                {t.see}
              </Button>
            </BoardSection>
          )}
        </div>
      </div>
    </PageMain>
  );
}

const CLASS_PREVIEW = 6;
const PAGE = 6;

/** Up to three rombel under a group card: rombel chip and its count. */
function TopClasses({ title, tone, items }: { title: string; tone: 'telat' | 'alpa'; items: { id: string; name: string; text: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-small font-semibold text-tinta">{title}</h3>
      <ul aria-label={title} className="m-0 grid list-none grid-cols-3 gap-2 p-0">
        {items.map((c) => (
          <li key={c.id} className="flex flex-col items-start gap-1 rounded-ubin bg-ubin p-3">
            <Chip tone={tone} square>
              {c.name}
            </Chip>
            <span className="text-small font-semibold text-tinta">{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Search over the late sessions (rombel, mapel, guru) and pages of six. */
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
