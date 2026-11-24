'use client';

import { ClassList } from '@absah/contracts';
import { Banner, buttonStyles, cx, DataHeader, DataToolbar, EmptyState, ErrorState, Field, PageMain, Select, SkeletonRows, Table, TableBody, TableHead, TableRow, Td, Th, messages } from '@absah/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { STUDENT_MANAGERS, STUDENT_READERS } from '@/lib/student-access';
import { useSection } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';

const t = messages.classes;
const d = messages.data;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/**
 * Rombel of the active academic year (AKD-02; U6c). The list is small and comes whole, so search and the Kelas filter work on what is
 * here. Not on this page because the API has no endpoint: Kenaikan kelas, Tambah rombel, Ubah wali kelas (wali kelas is set on /jadwal).
 */
export default function RombelPage() {
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole(...STUDENT_READERS);
  const canManage = hasRole(...STUDENT_MANAGERS);
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const section = useSection(`${schoolId ?? ''}:classes`, schoolId && allowed ? () => api('/classes', ClassList, { schoolId }) : null, (x) => x.items.length === 0);
  const items = section.data?.items;
  const grades = useMemo(() => [...new Set((items ?? []).map((c) => c.grade))].sort((a, b) => a - b), [items]);
  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (items ?? []).filter((c) => (!grade || String(c.grade) === grade) && (!term || c.name.toLowerCase().includes(term))), [items, grade, term]);

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

  const year = section.data?.academicYear?.name;
  return (
    <PageMain width="xl">
      <DataHeader
        title={year ? `${t.title} ${year}` : t.title}
        subtitle={items && items.length > 0 ? fill(t.subtitle, { n: items.length }) : undefined}
        actions={
          canManage && (
            <Link href="/import" className={cx(buttonStyles({ variant: 'secondary', size: '48' }), 'no-underline')}>
              {t.importAction}
            </Link>
          )
        }
      />
      {items && items.length > 0 && (
        <DataToolbar search={{ label: t.searchLabel, value: q, onChange: setQ, placeholder: t.searchPlaceholder }}>
          <Field label={t.gradeLabel} className="min-w-44">
            <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{t.allGrades}</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </DataToolbar>
      )}
      {section.state === 'offline' && <Banner kind="offline">{d.offlineBody}</Banner>}
      {section.state === 'error' && (
        <ErrorState title={d.loadFailed} onRetry={section.reload}>
          {d.loadFailedBody}
        </ErrorState>
      )}
      {section.state === 'loading' && <SkeletonRows count={6} />}
      {section.state === 'empty' && (
        <EmptyState title={t.empty}>
          {canManage ? (
            <>
              Rombel dibuat otomatis saat <Link href="/import">import data siswa</Link>.
            </>
          ) : (
            t.emptyBody
          )}
        </EmptyState>
      )}
      {items && items.length > 0 && shown.length === 0 && <EmptyState title={t.emptySearch}>{t.emptySearchBody}</EmptyState>}
      {shown.length > 0 && (
        <Table caption={t.table} className="min-w-160">
          <TableHead>
            <TableRow>
              <Th>{t.colClass}</Th>
              <Th>{t.colGrade}</Th>
              <Th>{t.colHomeroom}</Th>
              <Th className="text-right">{t.colStudents}</Th>
              <Th className="text-right">{t.colMissing}</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.id}>
                <Th scope="row">
                  <Link href={`/siswa?rombel=${c.id}`} className="text-papan">
                    {c.name}
                  </Link>
                </Th>
                <Td>
                  {c.grade}
                  {c.stream ? ` · ${t.streams[c.stream] ?? c.stream}` : ''}
                </Td>
                <Td className={c.homeroomTeacher ? undefined : 'text-tinta-muted'}>{c.homeroomTeacher?.name ?? t.noHomeroom}</Td>
                <Td className="text-right tabular-nums">{c.activeStudents}</Td>
                <Td className="text-right tabular-nums">{c.missingStudents > 0 ? <span className="text-body-strong text-telat">{c.missingStudents}</span> : 0}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageMain>
  );
}
