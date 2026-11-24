import type { ReactNode } from 'react';
import { WorkspaceProvider } from '@/lib/workspace';

// Staff area: admin, operator, guru, wali kelas, piket, ... Requires a session.
export default function StafLayout({ children }: { children: ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
