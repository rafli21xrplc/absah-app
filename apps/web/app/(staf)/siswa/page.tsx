'use client';

import { ClassList, StudentList, StudentListItem } from '@absah/contracts';
import { Banner, Button, buttonStyles, DataHeader, DataToolbar, EmptyState, ErrorState, ExitDialog, Field, PageMain, SegmentedControl, Select, SkeletonRows, Table, TableBody, TableHead, TableRow, Td, Th, cx, messages } from '@absah/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { isTransient } from '@/lib/offline-queue';
import { STUDENT_MANAGERS, STUDENT_READERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';

const t = messages.students;
const d = messages.data;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

type Status = 'active' | 'missing' | 'all';
type Exit = 'moved' | 'left';
type LoadState = 'loading' | 'ready' | 'error' | 'offline';

const STATUSES = [
  { value: 'active', label: t.statusActive },
  { value: 'missing', label: t.statusMissing },
  { value: 'all', label: t.statusAll },
] as const;
const REASONS = [
  { value: 'moved', label: t.reasonMoved },
  { value: 'left', label: t.reasonLeft },
] as const;

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Data siswa (AKD-01; U6b, the pattern the other Data pages follow): header, toolbar, table, one dialog. Not on this page because the
 * API has no endpoint yet: Tambah siswa, Ubah identitas, Ekspor Excel. Their buttons are left out, not shown dead.
 */
function StudentsView() {
  const params = useSearchParams();
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole(...STUDENT_READERS);
  const canManage = hasRole(...STUDENT_MANAGERS);

  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<Status>(params.get('status') === 'missing' ? 'missing' : 'active');
  const [classId, setClassId] = useState(params.get('rombel') ?? '');
  const [classes, setClasses] = useState<ClassList['items']>([]);
  const [items, setItems] = useState<StudentListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [leaving, setLeaving] = useState<StudentListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** One Idempotency-Key per (student, answer): kept when the reply was lost, dropped once the API answered. */
  const keys = useRef(new Map<string, string>());
  const term = useDebounced(q.trim());

  const query = useCallback(
    (after: string | null) => {
      const p = new URLSearchParams({ status, limit: '50' });
      if (term) p.set('q', term);
      if (classId) p.set('classId', classId);
      if (after) p.set('cursor', after);
      return api(`/students?${p.toString()}`, StudentList, { schoolId });
    },
    [schoolId, status, term, classId],
  );

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api('/classes', ClassList, { schoolId })
      .then((c) => setClasses(c.items))
      .catch(() => undefined);
  }, [schoolId, allowed]);

  useEffect(() => {
    if (!schoolId || !allowed) return;
    let cancelled = false;
    query(null)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(isTransient(err) ? 'offline' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [query, schoolId, allowed, attempt]);

  /** A new search or filter starts again from the top: the old rows stay until the new ones arrive. */
  function change<V>(set: (value: V) => void) {
    return (value: V) => {
      set(value);
      setState('loading');
    };
  }

  async function loadMore() {
    if (!cursor) return;
    setMoreBusy(true);
    try {
      const page = await query(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setState(isTransient(err) ? 'offline' : 'error');
    } finally {
      setMoreBusy(false);
    }
  }

  async function settle(student: StudentListItem, next: 'active' | Exit): Promise<boolean> {
    if (!schoolId || !student.enrollment) return false;
    const slot = `${student.id}:${next}`;
    const idempotencyKey = keys.current.get(slot) ?? newIdempotencyKey();
    keys.current.set(slot, idempotencyKey);
    setBusy(true);
    setFailed(null);
    try {
      const updated = await api(`/enrollments/${student.enrollment.id}`, StudentListItem, { method: 'PATCH', body: { status: next }, schoolId, idempotencyKey });
      keys.current.delete(slot);
      // A student who left is no longer on the active or calon keluar list; "Semua" shows the new state.
      setItems((list) => (next === 'active' && status === 'missing') || (next !== 'active' && status !== 'all') ? list.filter((s) => s.id !== student.id) : list.map((s) => (s.id === student.id ? updated : s)));
      setDone(fill(next === 'moved' ? t.doneMoved : next === 'left' ? t.doneLeft : t.doneStay, { name: student.name }));
      return true;
    } catch (err) {
      if (err instanceof ApiError) keys.current.delete(slot);
      setFailed(err instanceof ApiError ? err.message : d.saveFailed);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <PageMain width="xl">
        <h1 className="m-0 text-h1">{t.title}</h1>
        <p role="alert" className="m-0 text-body">
          {d.forbidden}
        </p>
      </PageMain>
    );
  }

  const showAction = canManage;
  return (
    <PageMain width="xl">
      <DataHeader
        title={t.title}
        subtitle={classes.length > 0 ? fill(t.subtitle, { n: classes.length }) : undefined}
        actions={
          canManage && (
            <Link href="/import" className={cx(buttonStyles({ variant: 'secondary', size: '48' }), 'no-underline')}>
              {t.importAction}
            </Link>
          )
        }
      />
      <DataToolbar search={{ label: t.searchLabel, value: q, onChange: change(setQ), placeholder: t.searchPlaceholder }}>
        <Field label={t.classLabel} className="min-w-44">
          <Select value={classId} onChange={(e) => change(setClassId)(e.target.value)}>
            <option value="">{t.allClasses}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <SegmentedControl label={t.statusLabel} options={STATUSES} value={status} onChange={change(setStatus)} />
      </DataToolbar>
      {status === 'missing' && <Banner kind="info">{t.missingNotice}</Banner>}
      {state === 'offline' && <Banner kind="offline">{d.offlineBody}</Banner>}
      {done && (
        <p role="status" className="m-0 text-small text-papan">
          {done}
        </p>
      )}
      {state === 'error' && (
        <ErrorState title={d.loadFailed} onRetry={() => { setState('loading'); setAttempt((n) => n + 1); }}>
          {d.loadFailedBody}
        </ErrorState>
      )}
      {state === 'loading' && items.length === 0 && <SkeletonRows count={6} />}
      {state !== 'error' && state !== 'loading' && items.length === 0 && <EmptyState title={t.empty}>{t.emptyBody}</EmptyState>}
      {items.length > 0 && (
        <>
          <Table caption={t.table} className="min-w-160">
            <TableHead>
              <TableRow>
                <Th>{t.colName}</Th>
                <Th>{t.colClass}</Th>
                <Th>{t.colGender}</Th>
                <Th>{t.colStatus}</Th>
                {showAction && <Th>{t.colAction}</Th>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <Th scope="row" className="font-normal">
                    <span className="flex flex-col">
                      <span className="text-body-strong text-tinta">{s.name}</span>
                      <span className="text-small text-tinta-muted">{s.nisn ? `NISN ${s.nisn}` : t.noNisn}</span>
                    </span>
                  </Th>
                  <Td className={s.enrollment ? undefined : 'text-tinta-muted'}>{s.enrollment?.className ?? t.noClass}</Td>
                  <Td>{s.gender === 'L' ? t.male : s.gender === 'P' ? t.female : '–'}</Td>
                  <Td>
                    {s.enrollment?.missingSince ? (
                      <span className="text-body-strong text-telat">{t.pillMissing}</span>
                    ) : s.enrollment ? (
                      <span className="text-body-strong text-hadir">{t.pillActive}</span>
                    ) : (
                      <span className="text-tinta-muted">{t.inactive}</span>
                    )}
                  </Td>
                  {showAction && (
                    <Td>
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/siswa/kontak?id=${s.id}`} aria-label={fill(t.contactOf, { name: s.name })} className="text-body-strong text-papan">
                          {t.contact}
                        </Link>
                        {s.enrollment?.missingSince && (
                          <Button variant="secondary" disabled={busy} aria-label={fill(t.stayOf, { name: s.name })} onClick={() => void settle(s, 'active')}>
                            {t.stay}
                          </Button>
                        )}
                        {s.enrollment && (
                          <Button variant="secondary" aria-label={fill(t.exitOf, { name: s.name })} onClick={() => { setFailed(null); setLeaving(s); }}>
                            {t.exit}
                          </Button>
                        )}
                      </span>
                    </Td>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center gap-3">
            <p className="m-0 text-small text-tinta-muted">{fill(t.shown, { n: items.length })}</p>
            {cursor && (
              <Button variant="secondary" loading={moreBusy} onClick={() => void loadMore()}>
                {d.more}
              </Button>
            )}
          </div>
        </>
      )}
      <ExitDialog
        open={leaving !== null}
        onOpenChange={(open) => !open && !busy && setLeaving(null)}
        title={fill(t.exitTitle, { name: leaving?.name ?? '' })}
        description={t.exitBody}
        reasonLabel={t.exitReason}
        reasons={REASONS}
        confirmLabel={t.exit}
        busy={busy}
        error={failed}
        onConfirm={(reason) => {
          if (leaving) void settle(leaving, reason).then((ok) => ok && setLeaving(null));
        }}
      />
    </PageMain>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<SkeletonRows count={6} />}>
      <StudentsView />
    </Suspense>
  );
}
