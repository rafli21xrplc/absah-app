'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Release } from '@/lib/changelog';

const ChangelogContext = createContext<readonly Release[]>([]);

/** The release notes read on the server (lib/changelog-files.ts), handed to the client pages that show them. */
export function ChangelogProvider({ releases, children }: { releases: readonly Release[]; children: ReactNode }) {
  return <ChangelogContext.Provider value={releases}>{children}</ChangelogContext.Provider>;
}

export const useReleases = () => useContext(ChangelogContext);
