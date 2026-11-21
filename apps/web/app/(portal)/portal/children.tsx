'use client';

import { PortalAttendance } from '@absah/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { childKey, parentSchools, pickSelected, sortChildren, type PortalChild } from '@/lib/portal-children';
import { useWorkspace } from '@/lib/workspace';
import { ChildPicker } from './child-picker';

interface Children {
  status: 'loading' | 'ready';
  children: readonly PortalChild[];
  /** A school that did not answer: its children are missing from the list. */
  partial: boolean;
  selected: PortalChild | null;
  select: (child: PortalChild) => void;
}

const ChildrenContext = createContext<Children | null>(null);
const STORAGE_KEY = 'absah.portal.child';

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The children of the signed-in parent across every school where the login is an orang tua (ORT-03/04).
 * There is no cross-school call: each school is asked on its own with X-School-Id, so RLS decides what
 * is visible, and the answers are put together here. Choosing a child at another school switches the
 * active school, so capabilities and the other portal pages follow.
 */
export function ChildrenProvider({ children }: { children: ReactNode }) {
  const { me, schoolId, selectSchool } = useWorkspace();
  const schools = useMemo(() => parentSchools(me), [me]);
  const [state, setState] = useState<{ status: 'loading' | 'ready'; list: PortalChild[]; partial: boolean }>({ status: schools.length === 0 ? 'ready' : 'loading', list: [], partial: false });
  // Safe to read at once: this provider renders only after the workspace loaded on the client.
  const [choice, setChoice] = useState<string | null>(remembered);

  useEffect(() => {
    if (schools.length === 0) return;
    const controller = new AbortController();
    void Promise.allSettled(
      schools.map(async (s) => {
        const res = await api('/portal/attendance?days=1', PortalAttendance, { schoolId: s.id, signal: controller.signal });
        return res.items.map((i): PortalChild => ({ key: childKey(s.id, i.studentId), schoolId: s.id, schoolName: s.name, studentId: i.studentId, enrollmentId: i.enrollmentId, name: i.name, className: i.className }));
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      setState({
        status: 'ready',
        list: sortChildren(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))),
        partial: results.some((r) => r.status === 'rejected'),
      });
    });
    return () => controller.abort();
  }, [schools]);

  const selected = pickSelected(state.list, choice, schoolId);

  // Keep the active school on the child's school (first load, or after another school was picked elsewhere).
  useEffect(() => {
    if (selected && selected.schoolId !== schoolId) selectSchool(selected.schoolId);
  }, [selected, schoolId, selectSchool]);

  const select = useCallback(
    (child: PortalChild) => {
      setChoice(child.key);
      try {
        localStorage.setItem(STORAGE_KEY, child.key);
      } catch {
        // private mode: the choice just is not remembered
      }
      if (child.schoolId !== schoolId) selectSchool(child.schoolId);
    },
    [schoolId, selectSchool],
  );

  const value: Children = { status: state.status, children: state.list, partial: state.partial, selected, select };
  return (
    <ChildrenContext value={value}>
      <ChildPicker items={state.list} selected={selected} onSelect={select} partial={state.partial} />
      {children}
    </ChildrenContext>
  );
}

export function useChildren(): Children {
  const value = useContext(ChildrenContext);
  if (!value) throw new Error('useChildren must be used inside <ChildrenProvider>');
  return value;
}
