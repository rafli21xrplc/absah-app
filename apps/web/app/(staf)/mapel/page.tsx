'use client';

import { CreateSubjectRequest, Subject, SubjectList } from '@absah/contracts';
import { Banner, Button, Chip, DataHeader, DataToolbar, Drawer, EmptyState, ErrorState, Field, Input, PageMain, SkeletonRows, Table, TableBody, TableHead, TableRow, Td, Th, messages } from '@absah/ui';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { SCHEDULE_MANAGERS, SCHEDULE_PAGE_READERS } from '@/lib/schedule-access';
import { useSection } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';

const t = messages.subjects;
const d = messages.data;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/**
 * Mata pelajaran (U6c; new page, per-period schools). The API can list and add (admin, operator, wakasek). It cannot rename or remove,
 * so those buttons are not on the page.
 */
export default function MapelPage() {
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole(...SCHEDULE_PAGE_READERS);
  const canManage = hasRole(...SCHEDULE_MANAGERS);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** One key per attempt, kept when the reply was lost so a second tap cannot add the subject twice. */
  const key = useRef<string | null>(null);
  const section = useSection(`${schoolId ?? ''}:subjects`, schoolId && allowed ? () => api('/subjects', SubjectList, { schoolId }) : null, (x) => x.items.length === 0);
  const items = section.data?.items;
  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (items ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || (s.code ?? '').toLowerCase().includes(term)), [items, term]);

  function open() {
    setName('');
    setCode('');
    setError(null);
    key.current = null;
    setAdding(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = CreateSubjectRequest.safeParse({ name, ...(code.trim() ? { code } : {}) });
    if (!body.success) {
      setError(body.error.issues[0]?.message ?? d.saveFailed);
      return;
    }
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const added = await api('/subjects', Subject, { method: 'POST', body: body.data, schoolId, idempotencyKey: key.current });
      key.current = null;
      setAdding(false);
      setDone(fill(t.done, { name: added.name }));
      section.reload();
    } catch (err) {
      if (err instanceof ApiError) key.current = null;
      setError(err instanceof ApiError ? err.message : d.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <PageMain width="full">
        <h1 className="m-0 text-h1">{t.title}</h1>
        <p role="alert" className="m-0 text-body">
          {d.forbidden}
        </p>
      </PageMain>
    );
  }

  return (
    <PageMain width="full">
      <DataHeader title={t.title} subtitle={items && items.length > 0 ? fill(t.subtitle, { n: items.length }) : undefined} />
      <DataToolbar
        search={{ label: t.searchLabel, value: q, onChange: setQ, placeholder: t.searchPlaceholder }}
        actions={canManage && <Button onClick={open}>{t.add}</Button>}
      />
      {section.state === 'offline' && <Banner kind="offline">{d.offlineBody}</Banner>}
      {done && (
        <p role="status" className="m-0 text-small text-papan">
          {done}
        </p>
      )}
      {section.state === 'error' && (
        <ErrorState title={d.loadFailed} onRetry={section.reload}>
          {d.loadFailedBody}
        </ErrorState>
      )}
      {section.state === 'loading' && <SkeletonRows count={6} />}
      {section.state === 'empty' && <EmptyState title={t.empty}>{canManage ? t.emptyManage : t.emptyRead}</EmptyState>}
      {items && items.length > 0 && shown.length === 0 && <EmptyState kind="search" title={t.emptySearch}>{t.emptySearchBody}</EmptyState>}
      {shown.length > 0 && (
        <Table caption={t.table} className="min-w-96">
          <TableHead>
            <TableRow>
              <Th>{t.colName}</Th>
              <Th>{t.colCode}</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((s) => (
              <TableRow key={s.id}>
                <Th scope="row">{s.name}</Th>
                <Td>{s.code ? <Chip square>{s.code}</Chip> : <span className="text-tinta-muted">{t.noCode}</span>}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Drawer
        open={adding}
        onOpenChange={(next) => !busy && setAdding(next)}
        title={t.drawerTitle}
        onSubmit={(e) => void submit(e)}
        actions={
          <Button type="submit" loading={busy}>
            {t.save}
          </Button>
        }
      >
        <Field label={t.nameLabel} error={error ?? undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t.codeLabel} optional hint={t.codeHint}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </Field>
      </Drawer>
    </PageMain>
  );
}
