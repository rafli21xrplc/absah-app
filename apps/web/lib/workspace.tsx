'use client';

import { MeContextResponse } from '@absah/contracts';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { CapabilitiesProvider } from './capabilities';

type Me = MeContextResponse;
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; me: Me };

interface Workspace {
  me: Me;
  schoolId: string | null;
  isAdmin: boolean;
  selectSchool: (id: string | null) => void;
  reload: () => void;
}

const WorkspaceContext = createContext<Workspace | null>(null);
const STORAGE_KEY = 'absah.schoolId';

function storedSchool(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSchool(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode: the choice just is not remembered
  }
}

/**
 * Loads who the user is and the active school (GET /me/context), redirects to /masuk without a
 * session and to /keamanan/dua-langkah when the role needs TOTP. Feeds capabilities to <IfCap>.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const base = await api('/me/context', MeContextResponse, { signal: controller.signal });
        const ids = base.schools.map((s) => s.id);
        const remembered = schoolId ?? storedSchool();
        const chosen = remembered && ids.includes(remembered) ? remembered : ids.length === 1 ? (ids[0] ?? null) : null;
        if (chosen !== schoolId) setSchoolId(chosen);
        const me = chosen
          ? await api('/me/context', MeContextResponse, { schoolId: chosen, signal: controller.signal })
          : base;
        setState({ status: 'ready', me });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) router.replace(`/masuk?lanjut=${encodeURIComponent(pathname)}`);
        else if (err instanceof ApiError && err.code === 'TWO_FACTOR_REQUIRED') router.replace('/keamanan/dua-langkah');
        else setState({ status: 'error', message: err instanceof Error ? err.message : 'Gagal memuat data.' });
      }
    })();
    return () => controller.abort();
  }, [schoolId, version, router, pathname]);

  const selectSchool = useCallback((id: string | null) => {
    storeSchool(id);
    setSchoolId(id);
  }, []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  if (state.status === 'loading') return <p role="status" style={{ padding: 24 }}>Memuat…</p>;
  if (state.status === 'error') return <p role="alert" style={{ padding: 24 }}>{state.message}</p>;

  const value: Workspace = {
    me: state.me,
    schoolId: state.me.active?.schoolId ?? null,
    isAdmin: state.me.active?.roles.includes('admin') ?? false,
    selectSchool,
    reload,
  };
  return (
    <WorkspaceContext value={value}>
      <CapabilitiesProvider capabilities={state.me.active?.capabilities}>{children}</CapabilitiesProvider>
    </WorkspaceContext>
  );
}

export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ws;
}
