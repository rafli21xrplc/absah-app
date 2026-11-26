'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Filters, sort and page of a list kept in the query string (v3 rule: a filtered view can be shared and survives a reload).
 * Writes with history.replaceState, which Next.js folds into useSearchParams without a navigation. Empty values are dropped.
 * The page using it sits inside <Suspense> (useSearchParams).
 */
export function useUrlState(): [URLSearchParams, (patch: Record<string, string | null>) => void] {
  const params = useSearchParams();
  const set = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);
  return [new URLSearchParams(params.toString()), set];
}
