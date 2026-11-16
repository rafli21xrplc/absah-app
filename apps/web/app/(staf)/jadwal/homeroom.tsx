'use client';

import { ClassListItem } from '@absah/contracts';
import { useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import type { ScheduleData } from './page';

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
      setStatus({ ok: true, text: `Wali kelas ${className}: ${updated.homeroomTeacher?.name ?? 'belum ditentukan'}.` });
      await onSaved();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak bisa menyimpan. Coba lagi.' });
    } finally {
      setSaving(null);
    }
  }

  const missing = data.classes.items.filter((c) => !c.homeroomTeacher).length;

  return (
    <section>
      {missing > 0 && <p className={forms.hint}>{missing} rombel belum punya wali kelas.</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rombel</th>
              <th>Wali kelas</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.items.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  {canEdit ? (
                    <select
                      className={forms.input}
                      aria-label={`Wali kelas ${c.name}`}
                      value={c.homeroomTeacher?.id ?? ''}
                      disabled={saving === c.id}
                      onChange={(e) => void assign(c.id, c.name, e.target.value || null)}
                    >
                      <option value="">Belum ditentukan</option>
                      {data.teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={c.homeroomTeacher ? undefined : styles.muted}>{c.homeroomTeacher?.name ?? 'Belum ditentukan'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status && (
        <p className={status.ok ? styles.notice : forms.error} role={status.ok ? 'status' : 'alert'}>
          {status.text}
        </p>
      )}
    </section>
  );
}
