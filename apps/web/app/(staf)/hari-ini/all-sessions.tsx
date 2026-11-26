'use client';

import type { SessionSummary } from '@absah/contracts';
import { Badge, DataCard, messages, Pagination, SearchBox, SegmentedControl, Table, TableBody, TableHead, TableRow, Td, Th, usePaged, type Tone } from '@absah/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const t = messages.today;
const PAGE = 12;

export type RowState = 'now' | 'fill' | 'next' | 'done' | 'missed' | 'locked' | 'waiting';
type Filter = 'todo' | 'next' | 'done' | 'all';

const STATE: Record<RowState, { label: string; tone: Tone; filter: Exclude<Filter, 'all'> }> = {
  now: { label: t.rowNow, tone: 'papan', filter: 'todo' },
  fill: { label: t.rowFill, tone: 'telat', filter: 'todo' },
  next: { label: t.rowNext, tone: 'netral', filter: 'next' },
  done: { label: t.rowDone, tone: 'hadir', filter: 'done' },
  missed: { label: t.rowMissed, tone: 'alpa', filter: 'done' },
  locked: { label: t.rowLocked, tone: 'netral', filter: 'done' },
  waiting: { label: t.rowWaiting, tone: 'izin', filter: 'done' },
};

const dotted = (hhmm: string) => hhmm.replace(':', '.');

/**
 * "Semua sesi" on a laptop (PG2): one dense table instead of hundreds of cards. The state of each row comes from the page's own
 * grouping (groupToday on the server clock), never worked out again here.
 */
export function AllSessionsTable({ rows }: { rows: { session: SessionSummary; state: RowState }[] }) {
  const [filter, setFilter] = useState<Filter>('todo');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const count = (f: Filter) => (f === 'all' ? rows.length : rows.filter((r) => STATE[r.state].filter === f).length);
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === 'all' || STATE[r.state].filter === filter) &&
          (!q || [r.session.owner.name, r.session.subject?.name, r.session.teacher?.name].some((v) => v?.toLowerCase().includes(q))),
      ),
    [rows, filter, q],
  );
  const paged = usePaged(shown, PAGE);

  return (
    <DataCard
      title={t.allTitle}
      aside={t.allAside.replace('{n}', String(shown.length))}
      toolbar={
        <>
          <SearchBox label={t.allSearch} value={query} onChange={setQuery} className="w-64" />
          <SegmentedControl
            label={t.allFilter}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'todo', label: t.filterTodo, count: count('todo') },
              { value: 'next', label: t.filterNext, count: count('next') },
              { value: 'done', label: t.filterDone, count: count('done') },
              { value: 'all', label: t.filterAll, count: count('all') },
            ]}
          />
        </>
      }
      footer={<Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onPage={paged.setPage} />}
    >
      {shown.length === 0 ? (
        <p className="m-0 text-body text-tinta-muted">{t.allEmpty}</p>
      ) : (
        <Table bare caption={t.allTable} className="min-w-200">
          <TableHead>
            <TableRow>
              <Th>{t.colTime}</Th>
              <Th>{t.colClassSubject}</Th>
              <Th>{t.colTeacher}</Th>
              <Th className="text-right">{t.colStudents}</Th>
              <Th className="text-right">{t.colAbsent}</Th>
              <Th>{t.colStatus}</Th>
              <Th>
                <span className="sr-only">{t.colAction}</span>
              </Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.slice.map(({ session: s, state }) => {
              const fillable = state === 'now' || state === 'fill';
              return (
                <TableRow key={s.id}>
                  <Td className="whitespace-nowrap">
                    <span className="text-body-strong">{s.period ? `Jam ${s.period.number}` : '–'}</span>
                    {s.period && <span className="block text-small text-tinta-muted">{`${dotted(s.period.startsAt)}–${dotted(s.period.endsAt)}`}</span>}
                  </Td>
                  <Td>
                    <span className="text-body-strong">{s.owner.name}</span>
                    <span className="block text-small text-tinta-muted">{s.subject?.name ?? (s.mode === 'daily' ? t.daily : '–')}</span>
                  </Td>
                  <Td>{s.teacher?.name ?? t.noTeacher}</Td>
                  <Td className="text-right tabular-nums">{s.counts.students}</Td>
                  <Td className="text-right tabular-nums">{state === 'done' || state === 'locked' ? s.counts.absent : '–'}</Td>
                  <Td>
                    <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/sesi/${s.id}`} aria-label={`${fillable ? t.fill : t.view} ${s.owner.name}${s.subject ? ` · ${s.subject.name}` : ''}`} className="whitespace-nowrap text-body-strong text-papan">
                      {fillable ? t.fill : t.view}
                    </Link>
                  </Td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DataCard>
  );
}
