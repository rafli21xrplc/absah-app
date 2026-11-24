import type { ReactNode } from 'react';
import { RELEASES } from '@/lib/changelog-files';
import { WorkspaceProvider } from '@/lib/workspace';
import { ChangelogProvider } from './changelog-context';
import { PortalServiceWorker } from '../(portal)/service-worker';
import { OfflineSync } from './offline-sync';
import { StaffShell } from './staff-shell';

// Staff area: admin, operator, guru, wali kelas, piket, ... Requires a session. StaffShell adds the side menu (or the phone's
// top bar) around every page. The shared service worker keeps the
// session screens openable without signal and OfflineSync sends what was filled meanwhile (PRS-08).
export default function StafLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <PortalServiceWorker />
      <OfflineSync />
      <StaffShell>
        <ChangelogProvider releases={RELEASES}>{children}</ChangelogProvider>
      </StaffShell>
    </WorkspaceProvider>
  );
}
