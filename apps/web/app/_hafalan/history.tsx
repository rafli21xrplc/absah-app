'use client';

import { MemorizationLogList, surahLabel } from '@absah/contracts';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/** Setoran hafalan of one student, newest first (KEG-03); shared by staff and portal. reload bumps to refetch. */
export function HafalanHistory({ schoolId, studentId, reload = 0, className }: { schoolId: string; studentId: string; reload?: number; className?: string }) {
  const [list, setList] = useState<MemorizationLogList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/memorization-logs?studentId=${studentId}`, MemorizationLogList, { schoolId })
      .then(setList)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat hafalan.'));
  }, [schoolId, studentId, reload]);

  if (error) return <p role="alert">{error}</p>;
  if (!list) return <p role="status">Memuat…</p>;
  const first = list.name.split(/\s+/)[0] ?? list.name;
  return (
    <section className={className} aria-label={`Hafalan ${first}`}>
      <h2>Hafalan {first}</h2>
      {list.items.length === 0 && <p>Belum ada setoran.</p>}
      <ul>
        {list.items.map((l) => (
          <li key={l.id}>
            <strong>{surahLabel(l.surah, l.ayatFrom, l.ayatTo)}</strong>
            {l.juz ? ` · juz ${l.juz}` : ''} · {l.date}
            {l.score !== null ? ` · nilai ${l.score}` : ''}
            {l.listener ? ` · disimak ${l.listener.name}` : ''}
            {l.note ? <div>{l.note}</div> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
