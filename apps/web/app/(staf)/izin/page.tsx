'use client';

import { LeaveAttachmentLink, LeaveRequest, LeaveRequestList, type LeaveKind } from '@absah/contracts';
import {
  Badge,
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
import { CircleCheck, Clock, HeartPulse, FileText } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STAFF, LEAVE_STATUS_LABELS } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';

const t = messages.leavePage;
const PAGE = 10;
const TONE: Record<LeaveRequest['status'], Tone> = { pending: 'telat', approved: 'hadir', rejected: 'alpa', cancelled: 'netral' };

/** Izin siswa: the wali kelas decides parents' requests and can enter one for them (IZN). PG1: stat cards + one table card. */
export default function IzinPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const staff = hasRole(...LEAVE_STAFF);
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
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

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (items ?? []).filter((l) => (status === 'all' || l.status === 'pending') && (!kind || l.kind === kind) && (!q || l.student.name.toLowerCase().includes(q) || l.student.className.toLowerCase().includes(q))),
    [items, status, kind, q],
  );
  const paged = usePaged(shown, PAGE);
  const count = (f: (l: LeaveRequest) => boolean) => (items ?? []).filter(f).length;

  return (
    <PageMain width="xl">
      <DataHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link href="/izin/baru" className={cx(buttonStyles({ size: '48' }), 'no-underline')}>
            {t.new}
          </Link>
        }
      />

      {items && (
        <ul aria-label={t.summary} className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          <li className="flex">
            <StatCard className="flex-1" title={t.pending} tone="telat" icon={Clock} value={count((l) => l.status === 'pending')} unit={t.requests} note={t.pendingNote} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={LEAVE_KIND_LABELS.sakit} tone="sakit" icon={HeartPulse} value={count((l) => l.kind === 'sakit')} unit={t.requests} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={LEAVE_KIND_LABELS.izin} tone="izin" icon={FileText} value={count((l) => l.kind === 'izin')} unit={t.requests} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.approved} tone="hadir" icon={CircleCheck} value={count((l) => l.status === 'approved')} unit={t.requests} />
          </li>
        </ul>
      )}

      <DataCard
        title={t.listTitle}
        {...(items ? { aside: t.count.replace('{n}', String(shown.length)) } : {})}
        toolbar={
          <>
            <SearchBox label={t.search} value={query} onChange={setQuery} className="w-72" />
            <label className="flex items-center gap-2 text-small text-tinta-muted">
              {t.kind}
              <Select value={kind} onChange={(e) => setKind(e.target.value as '' | LeaveKind)}>
                <option value="">{t.allKinds}</option>
                <option value="sakit">{LEAVE_KIND_LABELS.sakit}</option>
                <option value="izin">{LEAVE_KIND_LABELS.izin}</option>
              </Select>
            </label>
            <SegmentedControl
              label={t.show}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pending', label: t.pending },
                { value: 'all', label: t.all },
              ]}
            />
          </>
        }
        footer={<Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onPage={paged.setPage} />}
      >
        {error && <ErrorState headingLevel="h3" title={error} onRetry={() => setAttempt((n) => n + 1)} />}
        {!items && !error && <SkeletonRows count={4} />}
        {items && shown.length === 0 && <EmptyState bare headingLevel="h3" title={q || kind ? t.noMatch : status === 'pending' ? t.emptyPending : t.empty} />}
        {shown.length > 0 && (
          <Table bare caption={t.table} className="min-w-200">
            <TableHead>
              <TableRow>
                <Th>{t.colStudent}</Th>
                <Th>{t.colKind}</Th>
                <Th>{t.colDates}</Th>
                <Th>{t.colReason}</Th>
                <Th>{t.colStatus}</Th>
                <Th>{t.colAction}</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.slice.map((l) => (
                <TableRow key={l.id} aria-label={`Izin ${l.student.name}`}>
                  <Th scope="row" className="font-normal">
                    <PersonCell name={l.student.name} detail={l.student.className} />
                  </Th>
                  <Td>
                    <Badge tone={l.kind === 'sakit' ? 'sakit' : 'izin'}>{LEAVE_KIND_LABELS[l.kind]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{dateRangeLabel(l.startsOn, l.endsOn)}</Td>
                  <Td>
                    <span className="flex max-w-80 flex-col">
                      <span className="line-clamp-2">“{l.reason}”</span>
                      <span className="text-small text-tinta-muted">{t.by.replace('{name}', l.requestedBy?.name ?? '-')}</span>
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-col items-start gap-1">
                      <Badge tone={TONE[l.status]}>{LEAVE_STATUS_LABELS[l.status]}</Badge>
                      {l.decidedBy && l.status !== 'pending' && <span className="text-small text-tinta-muted">{l.decidedBy.name}</span>}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-2">
                      {l.status === 'pending' && staff && l.requestedBy?.id !== me.user.id && (
                        <>
                          <Button size="44" disabled={busy === l.id} onClick={() => void act(l, 'decide', { approve: true })}>
                            {t.approve}
                          </Button>
                          <Button size="44" variant="secondary" disabled={busy === l.id} onClick={() => void act(l, 'decide', { approve: false })}>
                            {t.reject}
                          </Button>
                        </>
                      )}
                      {l.hasAttachment && (
                        <Button size="44" variant="ghost" onClick={() => void openAttachment(l)}>
                          {t.attachment}
                        </Button>
                      )}
                      {(l.status === 'pending' || l.status === 'approved') && (
                        <Button size="44" variant="ghost" disabled={busy === l.id} onClick={() => void act(l, 'cancel')}>
                          {t.cancel}
                        </Button>
                      )}
                    </span>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataCard>
    </PageMain>
  );
}
