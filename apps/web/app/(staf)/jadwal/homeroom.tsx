'use client';

import { ClassListItem } from '@absah/contracts';
import { Banner, Select, Table, TableBody, TableHead, TableRow, Td, Th, messages } from '@absah/ui';
import { useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import type { ScheduleData } from './page';

const t = messages.schedule;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/** Wali kelas per rombel; each change is saved at once. */
export function HomeroomTable({ data, canEdit, onSaved }: { data: ScheduleData; canEdit: boolean; onSaved: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function assign(classId: string, className: string, teacherId: string | null) {
    setSaving(classId);
    setStatus(null);
    try {
      const updated = await api(`/classes/${classId}`, ClassListItem, {
        method: 'PATCH',
        body: { homeroomTeacherId: teacherId },
        schoolId,
        idempotencyKey: newIdempotencyKey(),
      });
      setStatus({ ok: true, text: fill(t.homeroomDone, { name: className, teacher: updated.homeroomTeacher?.name ?? 'belum ditentukan' }) });
      await onSaved();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ApiError ? err.message : t.saveFailed });
    } finally {
      setSaving(null);
    }
  }

  const missing = data.classes.items.filter((c) => !c.homeroomTeacher).length;

  return (
    <section className="flex flex-col gap-4">
      {missing > 0 && <p className="m-0 text-body text-tinta-muted">{fill(t.homeroomMissing, { n: missing })}</p>}
      <Table caption={t.homeroomTable} className="min-w-96">
        <TableHead>
          <TableRow>
            <Th>{t.homeroomClass}</Th>
            <Th>{t.homeroomTeacher}</Th>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.classes.items.map((c) => (
            <TableRow key={c.id}>
              <Th scope="row">{c.name}</Th>
              <Td>
                {canEdit ? (
                  <Select aria-label={fill(t.homeroomOf, { name: c.name })} value={c.homeroomTeacher?.id ?? ''} disabled={saving === c.id} onChange={(e) => void assign(c.id, c.name, e.target.value || null)} className="max-w-xs">
                    <option value="">{t.noTeacher}</option>
                    {data.teachers.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span className={c.homeroomTeacher ? undefined : 'text-tinta-muted'}>{c.homeroomTeacher?.name ?? t.noTeacher}</span>
                )}
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {status && (status.ok ? <p role="status" className="m-0 text-small text-papan">{status.text}</p> : <Banner kind="error">{status.text}</Banner>)}
    </section>
  );
}
