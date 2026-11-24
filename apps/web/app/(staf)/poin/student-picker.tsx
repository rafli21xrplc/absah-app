'use client';

import { Button } from '@absah/ui';
import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { api } from '@/lib/api';
import forms from '../../forms.module.css';
import ui from '../presensi.module.css';

export interface PickedStudent {
  enrollmentId: string;
  name: string;
  className: string;
}

/**
 * Finds a student by name (two letters or more) through a search endpoint the caller names. The picked student
 * is shown with a button to change; `onPick(null)` clears it.
 */
export function StudentPicker<S extends z.ZodType<{ items: PickedStudent[] }>>({
  schoolId,
  path,
  schema,
  student,
  onPick,
}: {
  schoolId: string | null;
  path: string;
  schema: S;
  student: PickedStudent | null;
  onPick: (s: PickedStudent | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PickedStudent[]>([]);

  useEffect(() => {
    if (!schoolId || query.trim().length < 2 || student) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`${path}?q=${encodeURIComponent(query.trim())}`, schema, { schoolId, signal: controller.signal })
        .then((r) => setFound(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schoolId, path, schema, query, student]);

  if (student) {
    return (
      <p>
        <strong>{student.name}</strong> · {student.className}{' '}
        <Button variant="secondary" type="button" onClick={() => onPick(null)}>
          Ganti siswa
        </Button>
      </p>
    );
  }
  return (
    <>
      <label className={forms.field}>
        Cari siswa
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik minimal 2 huruf nama" autoComplete="off" />
      </label>
      {query.trim().length >= 2 && (
        <ul className={ui.sessions} aria-label="Hasil pencarian">
          {found.map((s) => (
            <li key={s.enrollmentId}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setQuery('');
                  setFound([]);
                  onPick(s);
                }}
              >
                {s.name} · {s.className}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
