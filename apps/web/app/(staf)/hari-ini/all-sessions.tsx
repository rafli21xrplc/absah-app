'use client';

import type { SessionSummary } from '@absah/contracts';
import { Avatar, BoardSection, buttonStyles, Chip, CountList, cx, messages, Pagination, SearchBox, SegmentedControl, Table, TableBody, TableHead, TableRow, Td, Th, type ChipTone } from '@absah/ui';
import { CircleCheck, CircleDashed, CircleDot, Clock, Hourglass, Lock, Smartphone, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

const t = messages.today;
const PAGE = 10;

export type RowState = 'now' | 'fill' | 'next' | 'done' | 'missed' | 'locked' | 'waiting';
export type Filter = 'todo' | 'next' | 'done' | 'all';
export const FILTERS: readonly Filter[] = ['todo', 'next', 'done', 'all'];

const STATE: Record<RowState, { label: string; tone: ChipTone; icon: LucideIcon; filter: Exclude<Filter, 'all'> }> = {
  now: { label: t.rowNow, tone: 'papan', icon: CircleDot, filter: 'todo' },
  fill: { label: t.rowFill, tone: 'telat', icon: Clock, filter: 'todo' },
  next: { label: t.rowNext, tone: 'neutral', icon: Hourglass, filter: 'next' },
  done: { label: t.rowDone, tone: 'hadir', icon: CircleCheck, filter: 'done' },
  missed: { label: t.rowMissed, tone: 'alpa', icon: CircleDashed, filter: 'done' },
  locked: { label: t.rowLocked, tone: 'neutral', icon: Lock, filter: 'done' },
  waiting: { label: t.rowWaiting, tone: 'izin', icon: Smartphone, filter: 'done' },
};

const dotted = (hhmm: string) => hhmm.replace(':', '.');

export interface AllSessionsView {
  filter: Filter;
  query: string;
  page: number;
}

/**
 * "Semua sesi" on a laptop (PG2, v3 DataTable in V5): toolbar, a table with a sticky head and first column, pages of ten.
 * Filter, search and page live in the URL (the page passes them in). The state of each row comes from the page's own grouping
 * (groupToday on the server clock), never worked out again here. One row per session: the API has no per-student daily list
 * with jam masuk/pulang yet (TODO(api), docs/ui-v3-audit.md item 7).
 */
export function AllSessionsTable({ rows, view, onView }: { rows: { session: SessionSummary; state: RowState }[]; view: AllSessionsView; onView: (patch: Partial<AllSessionsView>) => void }) {
  const q = view.query.trim().toLowerCase();
  const count = (f: Filter) => (f === 'all' ? rows.length : rows.filter((r) => STATE[r.state].filter === f).length);
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (view.filter === 'all' || STATE[r.state].filter === view.filter) &&
          (!q || [r.session.owner.name, r.session.subject?.name, r.session.teacher?.name].some((v) => v?.toLowerCase().includes(q))),
      ),
    [rows, view.filter, q],
  );
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE));
  const page = Math.min(Math.max(1, view.page), pageCount);
  const slice = shown.slice((page - 1) * PAGE, page * PAGE);

  // Per jam ke-n: how many of its sessions are in (sent, locked, or waiting on a phone). Sessions without a period are "Harian".
  const perPeriod = useMemo(() => {
    const m = new Map<string, { label: string; order: number; done: number; total: number }>();
    for (const r of rows) {
      const key = r.session.period ? String(r.session.period.number) : 'harian';
      const e = m.get(key) ?? { label: r.session.period ? `Jam ${r.session.period.number}` : t.daily, order: r.session.period?.number ?? 99, done: 0, total: 0 };
      e.total += 1;
      if (r.state === 'done' || r.state === 'locked' || r.state === 'waiting') e.done += 1;
      m.set(key, e);
    }
    return [...m.entries()].sort((x, y) => x[1].order - y[1].order).map(([key, e]) => ({ key, label: e.label, value: e.done, of: e.total, text: `${e.done}/${e.total}` }));
  }, [rows]);
  const mostAbsent = useMemo(
    () =>
      rows
        .filter((r) => (r.state === 'done' || r.state === 'locked') && r.session.counts.absent > 0)
        .sort((x, y) => y.session.counts.absent - x.session.counts.absent)
        .slice(0, 6)
        .map(({ session: s }) => ({ key: s.id, label: s.owner.name, detail: s.subject?.name ?? t.daily, value: s.counts.absent, text: t.absentOf.replace('{n}', String(s.counts.absent)) })),
    [rows],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
      <BoardSection
        title={t.allTitle}
        subtitle={t.allSubtitle}
        count={t.allAside.replace('{n}', String(shown.length))}
        state="ready"
        action={<SearchBox label={t.allSearch} value={view.query} onChange={(v) => onView({ query: v, page: 1 })} className="w-64" />}
      >
        <SegmentedControl
          label={t.allFilter}
          value={view.filter}
          onChange={(f) => onView({ filter: f, page: 1 })}
          options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f], count: count(f) }))}
        />
        {shown.length === 0 ? (
          <p className="m-0 text-isi text-tinta-muted">{t.allEmpty}</p>
        ) : (
          <Table bare dense sticky caption={t.allTable} className="min-w-160">
            <TableHead>
              <TableRow>
                <Th>{t.colClassSubject}</Th>
                <Th>{t.colTime}</Th>
                <Th>{t.colTeacher}</Th>
                <Th className="text-right">{t.colPresent}</Th>
                <Th>{t.colStatus}</Th>
                <Th>
                  <span className="sr-only">{t.colAction}</span>
                </Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.map(({ session: s, state }) => {
                const fillable = state === 'now' || state === 'fill';
                const subject = s.subject?.name ?? (s.mode === 'daily' ? t.daily : '–');
                const st = STATE[state];
                return (
                  <TableRow key={s.id}>
                    <Td className="max-w-56">
                      <span className="flex min-w-0 items-center gap-2">
                        <Chip tone="papan" square className="min-w-12 justify-center">
                          {s.owner.name}
                        </Chip>
                        <span title={subject} className="truncate text-isi-strong">
                          {subject}
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-isi-strong">{s.period ? `Jam ${s.period.number}` : '–'}</span>
                      {s.period && <span className="block text-mini text-tinta-muted">{`${dotted(s.period.startsAt)}–${dotted(s.period.endsAt)}`}</span>}
                    </Td>
                    <Td className="max-w-56">
                      <span className="flex min-w-0 items-center gap-2">
                        {s.teacher && <Avatar name={s.teacher.name} seed={s.teacher.name} size={30} />}
                        <span title={s.teacher?.name ?? t.noTeacher} className="truncate text-isi">
                          {s.teacher?.name ?? t.noTeacher}
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right text-isi-strong tabular-nums">
                      {state === 'done' || state === 'locked' ? `${s.counts.students - s.counts.absent}/${s.counts.students}` : `–/${s.counts.students}`}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Chip tone={st.tone} icon={st.icon}>
                        {st.label}
                      </Chip>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/sesi/${s.id}`}
                        aria-label={`${fillable ? t.fill : t.view} ${s.owner.name}${s.subject ? ` · ${s.subject.name}` : ''}`}
                        className={cx(buttonStyles({ variant: fillable ? 'soft' : 'outline', size: '36' }), 'whitespace-nowrap no-underline')}
                      >
                        {fillable ? t.fillShort : t.view}
                      </Link>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageCount={pageCount} total={shown.length} size={PAGE} onPage={(p) => onView({ page: p })} />
      </BoardSection>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-1">
        <BoardSection title={t.perPeriodTitle} subtitle={t.perPeriodAside} state="ready">
          <CountList label={t.perPeriodTitle} rows={perPeriod} tone="hadir" />
        </BoardSection>
        <BoardSection title={t.mostAbsentTitle} state={mostAbsent.length > 0 ? 'ready' : 'empty'} emptyText={t.mostAbsentNone}>
          <CountList label={t.mostAbsentTitle} rows={mostAbsent} tone="alpa" />
        </BoardSection>
      </div>
    </div>
  );
}

const FILTER_LABEL: Record<Filter, string> = { todo: t.filterTodo, next: t.filterNext, done: t.filterDone, all: t.filterAll };
