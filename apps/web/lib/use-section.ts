'use client';

import type { SectionState } from '@absah/ui';
import { useEffect, useEffectEvent, useState } from 'react';
import { isTransient } from './offline-queue';

export interface Section<T> {
  state: SectionState;
  data: T | null;
  /** Loads again. The data that is already shown stays until the new answer arrives. */
  reload: () => void;
}

/**
 * One independent part of a board: its own request and its own four states, so a slow or broken part never holds back the others.
 * `key` says what the data is about (school, date); a new key starts from "loading". `load === null` waits (no school yet).
 * A request that got no answer (no signal) is "offline", an answer that was no is "error". `empty` is decided by the part itself.
 */
export function useSection<T>(key: string, load: (() => Promise<T>) | null, isEmpty: (data: T) => boolean = () => false): Section<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: 'ready' | 'error' | 'offline'; data: T | null } | null>(null);
  const run = useEffectEvent(() => load?.());
  const waiting = load === null;

  useEffect(() => {
    if (waiting) return;
    let alive = true;
    run()
      ?.then((data) => alive && setResult({ key, state: 'ready', data }))
      .catch((err: unknown) => alive && setResult({ key, state: isTransient(err) ? 'offline' : 'error', data: null }));
    return () => {
      alive = false;
    };
  }, [key, attempt, waiting]);

  const mine = result && result.key === key ? result : null;
  if (!mine) return { state: 'loading', data: null, reload: () => setAttempt((n) => n + 1) };
  const state: SectionState = mine.state === 'ready' && mine.data !== null && isEmpty(mine.data) ? 'empty' : mine.state;
  return { state, data: mine.data, reload: () => setAttempt((n) => n + 1) };
}
