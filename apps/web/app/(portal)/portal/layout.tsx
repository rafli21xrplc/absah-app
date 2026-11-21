import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspaceProvider } from '@/lib/workspace';
import { ChildrenProvider } from './children';

export const metadata: Metadata = { title: 'Portal' };

// The signed-in portal (PWA siswa, ORT-02). Without a session: WhatsApp OTP login.
// Parents choose a child at the top, across every school where this login is an orang tua (ORT-03/04).
export default function SignedInPortalLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider signInPath="/masuk/hp">
      <ChildrenProvider>{children}</ChildrenProvider>
    </WorkspaceProvider>
  );
}
