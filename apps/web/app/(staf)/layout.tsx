import type { ReactNode } from 'react';
import { RELEASES } from '@/lib/changelog-files';
import { WorkspaceProvider } from '@/lib/workspace';
import { ChangelogProvider } from './changelog-context';
import { PortalServiceWorker } from '../(portal)/service-worker';
import { OfflineSync } from './offline-sync';

// Staff area: admin, operator, guru, wali kelas, piket, ... Requires a session. The shared service worker keeps the
// session screens openable without signal and OfflineSync sends what was filled meanwhile (PRS-08).
export default function StafLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <PortalServiceWorker />
      <OfflineSync />
      <ChangelogProvider releases={RELEASES}>{children}</ChangelogProvider>
    </WorkspaceProvider>
  );
}
