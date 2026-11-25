'use client';

import { StudentList, type StudentListItem } from '@absah/contracts';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Two letters are enough to search a school's students; fewer would list everybody. */
export const MIN_SEARCH = 2;

/**
 * Students matching what is typed in the palette: the same endpoint as the Siswa page, six at most, after a short pause so
 * a fast typist sends one request. `term` empty (palette shut, or not allowed to read students) searches nothing.
 */
export function useStudentSearch(term: string, schoolId: string | null): { items: StudentListItem[]; busy: boolean } {
  const wanted = term.trim();
  const active = Boolean(schoolId) && wanted.length >= MIN_SEARCH;
  const [found, setFound] = useState<{ term: string; items: StudentListItem[] } | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ status: 'active', limit: '6', q: wanted });
      api(`/students?${params.toString()}`, StudentList, { schoolId, signal: controller.signal })
        .then((page) => setFound({ term: wanted, items: page.items }))
        .catch(() => undefined); // a failed search shows nothing; the page list is one tap away
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, wanted, schoolId]);

  if (!active) return { items: [], busy: false };
  return { items: found?.term === wanted ? found.items : [], busy: found?.term !== wanted };
}
