'use client';

import { LeaveAttachmentLink, LeaveRequest, LeaveRequestList, type LeaveKind } from '@absah/contracts';
import {
  Badge,
  CountList,
  Button,
  buttonStyles,
  cx,
  DataCard,
  DataHeader,
  EmptyState,
  ErrorState,
  messages,
  PageMain,
  Pagination,
  PersonCell,
  SearchBox,
  SegmentedControl,
  Select,
  SkeletonRows,
  StatCard,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  usePaged,
  type Tone,
} from '@absah/ui';
import { CalendarCheck, CalendarClock, CircleSlash, Clock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STAFF, LEAVE_STATUS_LABELS, todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';

const t = messages.leavePage;
const PAGE = 10;
const TODAY_PREVIEW = 6;
const TONE: Record<LeaveRequest['status'], Tone> = { pending: 'telat', approved: 'hadir', rejected: 'alpa', cancelled: 'netral' };

/** Izin siswa: the wali kelas decides parents' requests and can enter one for them (IZN). PG1: stat cards + one table card. */
export default function IzinPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const staff = hasRole(...LEAVE_STAFF);
  const timezone = me.schools.find((x) => x.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const today = todayIn(timezone);
  // null = not chosen yet: open on Menunggu when something waits, otherwise on Semua (an empty first table says nothing).
  const [chosen, setStatus] = useState<StatusFilter | null>(null);
  const [when, setWhen] = useState<When>('');
  const [kind, setKind] = useState<'' | LeaveKind>('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LeaveRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const fetchItems = useCallback(() => api('/leave-requests?status=all', LeaveRequestList, { schoolId }).then((r) => r.items), [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    fetchItems()
      .then((r) => {
        setError(null);
        setItems(r);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t.loadFailed));
  }, [schoolId, fetchItems, attempt]);

  async function act(leave: LeaveRequest, path: 'decide' | 'cancel', body: object = {}) {
    setBusy(leave.id);
    setError(null);
    try {
      await api(`/leave-requests/${leave.id}/${path}`, LeaveRequest, { method: 'POST', body, schoolId, idempotencyKey: newIdempotencyKey() });
      setItems(await fetchItems());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveFailed);
    } finally {
      setBusy(null);
    }
  }

  async function openAttachment(leave: LeaveRequest) {
    const tab = window.open('', '_blank');
    try {
      const link = await api(`/leave-requests/${leave.id}/attachment`, LeaveAttachmentLink, { schoolId });
      if (tab) tab.location.href = link.url;
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiError ? err.message : t.attachmentFailed);
    }
  }

  const status: StatusFilter = chosen ?? ((items ?? []).some((l) => l.status === 'pending') ? 'pending' : 'all');
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (items ?? []).filter(
        (l) =>
          statusMatch(l, status) &&
          (!kind || l.kind === kind) &&
          (!when || whenOf(l, today) === when) &&
          (!q || l.student.name.toLowerCase().includes(q) || l.student.className.toLowerCase().includes(q)),
      ),
    [items, status, kind, when, q, today],
  );
  const paged = usePaged(shown, PAGE);
  const count = (f: (l: LeaveRequest) => boolean) => (items ?? []).filter(f).length;

  const onToday = (items ?? []).filter((l) => l.status === 'approved' && whenOf(l, today) === 'today');
  // Requests that count (waiting or approved) per rombel, most first.
  const perClass = [...(items ?? []).filter((l) => l.status === 'pending' || l.status === 'approved').reduce((m, l) => m.set(l.student.className, (m.get(l.student.className) ?? 0) + 1), new Map<string, number>())]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([name, n]) => ({ key: name, label: name, value: n, text: t.count.replace('{n}', String(n)) }));

  return (
    <PageMain width="xl">
      <DataHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link href="/izin/baru" className={cx(buttonStyles(), 'no-underline')}>
            {t.new}
          </Link>
        }
      />

      {items && (
        <ul aria-label={t.summary} className="m-0 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
          <li className="flex">
            <StatCard
              className="flex-1"
              title={t.statToday}
              tone="izin"
              icon={CalendarCheck}
              value={onToday.length}
              unit={t.students}
              parts={[
                { value: onToday.filter((l) => l.kind === 'sakit').length, label: 'sakit' },
                { value: onToday.filter((l) => l.kind === 'izin').length, label: 'izin' },
              ]}
            />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.pending} tone="telat" icon={Clock} value={count((l) => l.status === 'pending')} unit={t.requests} note={t.pendingNote} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.statUpcoming} tone="papan" icon={CalendarClock} value={count((l) => l.status === 'approved' && whenOf(l, today) === 'upcoming')} unit={t.requests} note={t.upcomingNote} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.statClosed} tone="netral" icon={CircleSlash} value={count((l) => l.status === 'rejected' || l.status === 'cancelled')} unit={t.requests} parts={[{ value: count((l) => l.status === 'rejected'), label: 'ditolak' }, { value: count((l) => l.status === 'cancelled'), label: 'dibatalkan' }]} />
          </li>
        </ul>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <DataCard
        title={t.listTitle}
        {...(items ? { aside: t.count.replace('{n}', String(shown.length)) } : {})}
        toolbar={
          <>
            <SearchBox label={t.search} value={query} onChange={setQuery} className="w-56" />
          </>
        }
        footer={<Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onPage={paged.setPage} />}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-full">
        <SegmentedControl
          label={t.show}
          value={status}
          onChange={setStatus}
          options={STATUS_FILTERS.map((f) => ({ value: f, label: f === 'all' ? t.all : LEAVE_STATUS_LABELS[f], count: count((l) => statusMatch(l, f)) }))}
        />
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-small text-tinta-muted">
              {t.kind}
              <Select value={kind} onChange={(e) => setKind(e.target.value as '' | LeaveKind)}>
                <option value="">{t.allKinds}</option>
                <option value="sakit">{LEAVE_KIND_LABELS.sakit}</option>
                <option value="izin">{LEAVE_KIND_LABELS.izin}</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 text-small text-tinta-muted">
              {t.when}
              <Select value={when} onChange={(e) => setWhen(e.target.value as When)}>
                <option value="">{t.whenAll}</option>
                <option value="today">{t.whenToday}</option>
                <option value="upcoming">{t.whenUpcoming}</option>
                <option value="past">{t.whenPast}</option>
              </Select>
            </label>
        </div>
        </div>
        {error && <ErrorState headingLevel="h3" title={error} onRetry={() => setAttempt((n) => n + 1)} />}
        {!items && !error && <SkeletonRows count={4} />}
        {items && shown.length === 0 && <EmptyState bare headingLevel="h3" title={q || kind || when ? t.noMatch : status === 'pending' ? t.emptyPending : t.empty} />}
        {shown.length > 0 && (
          <Table bare dense caption={t.table} className="min-w-160">
            <TableHead>
              <TableRow>
                <Th>{t.colStudent}</Th>
                <Th>{t.colKindDates}</Th>
                <Th>{t.colReason}</Th>
                <Th>{t.colStatus}</Th>
                <Th>
                  <span className="sr-only">{t.colAction}</span>
                </Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.slice.map((l) => {
                const days = dayCount(l.startsOn, l.endsOn);
                return (
                  <TableRow key={l.id} aria-label={`Izin ${l.student.name}`}>
                    <Th scope="row" className="font-normal">
                      <PersonCell name={l.student.name} detail={l.student.className} />
                    </Th>
                    <Td className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Badge tone={l.kind === 'sakit' ? 'sakit' : 'izin'}>{LEAVE_KIND_LABELS[l.kind]}</Badge>
                        {dateRangeLabel(l.startsOn, l.endsOn)}
                      </span>
                      <span className="block text-small text-tinta-muted">
                        {t.days.replace('{n}', String(days))}
                        {whenOf(l, today) === 'today' ? ` · ${t.whenTodayShort}` : ''}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex max-w-56 flex-col">
                        <span className="truncate" title={l.reason}>
                          “{l.reason}”
                        </span>
                        <span className="truncate text-small text-tinta-muted">
                          {t.by.replace('{name}', l.requestedBy?.name ?? '-')}
                          {l.hasAttachment ? ` · ${t.hasAttachment}` : ''}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={TONE[l.status]}>{LEAVE_STATUS_LABELS[l.status]}</Badge>
                      {l.decidedBy && l.status !== 'pending' && <span className="block truncate text-small text-tinta-muted">{l.decidedBy.name}</span>}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap justify-end gap-1">
                        {l.status === 'pending' && staff && l.requestedBy?.id !== me.user.id && (
                          <>
                            <Button aria-label={`${t.approveFull} ${l.student.name}`} disabled={busy === l.id} onClick={() => void act(l, 'decide', { approve: true })}>
                              {t.approve}
                            </Button>
                            <Button variant="secondary" aria-label={`${t.rejectFull} ${l.student.name}`} disabled={busy === l.id} onClick={() => void act(l, 'decide', { approve: false })}>
                              {t.reject}
                            </Button>
                          </>
                        )}
                        {l.hasAttachment && (
                          <Button variant="ghost" aria-label={`${t.attachment} ${l.student.name}`} onClick={() => void openAttachment(l)}>
                            {t.attachmentShort}
                          </Button>
                        )}
                        {(l.status === 'pending' || l.status === 'approved') && (
                          <Button variant="ghost" aria-label={`${t.cancel} ${l.student.name}`} disabled={busy === l.id} onClick={() => void act(l, 'cancel')}>
                            {t.cancelShort}
                          </Button>
                        )}
                      </span>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataCard>

      <div className="order-first flex min-w-0 flex-col gap-4 lg:order-none">
        <DataCard title={t.todayTitle} {...(items ? { aside: t.count.replace('{n}', String(onToday.length)) } : {})}>
          {onToday.length === 0 ? (
            <p className="m-0 text-small text-tinta-muted">{t.todayNone}</p>
          ) : (
            <ul aria-label={t.todayTitle} className="m-0 flex list-none flex-col p-0">
              {onToday.slice(0, TODAY_PREVIEW).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 border-b border-garis py-1 last:border-b-0">
                  <PersonCell name={l.student.name} detail={`${l.student.className} · ${l.endsOn === today ? t.untilToday : t.until.replace('{date}', dateRangeLabel(l.endsOn, l.endsOn))}`} />
                  <Badge tone={l.kind === 'sakit' ? 'sakit' : 'izin'}>{LEAVE_KIND_LABELS[l.kind]}</Badge>
                </li>
              ))}
            </ul>
          )}
          {onToday.length > TODAY_PREVIEW && (
            <button
              type="button"
              onClick={() => {
                setStatus('approved');
                setWhen('today');
              }}
              className="cursor-pointer self-start border-0 bg-transparent p-0 text-small font-bold text-papan"
            >
              {t.todayAll.replace('{n}', String(onToday.length))}
            </button>
          )}
        </DataCard>
        <DataCard title={t.perClassTitle} aside={t.perClassAside}>
          {perClass.length > 0 ? <CountList label={t.perClassTitle} rows={perClass} tone="izin" /> : <p className="m-0 text-small text-tinta-muted">{t.empty}</p>}
        </DataCard>
      </div>
      </div>
    </PageMain>
  );
}

type StatusFilter = LeaveRequest['status'] | 'all';
type When = '' | 'today' | 'upcoming' | 'past';
const STATUS_FILTERS: StatusFilter[] = ['pending', 'approved', 'rejected', 'cancelled', 'all'];
const statusMatch = (l: LeaveRequest, f: StatusFilter) => f === 'all' || l.status === f;
/** ISO dates compare as strings; `today` is the school's date. */
const whenOf = (l: LeaveRequest, today: string): Exclude<When, ''> => (l.endsOn < today ? 'past' : l.startsOn > today ? 'upcoming' : 'today');
const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
