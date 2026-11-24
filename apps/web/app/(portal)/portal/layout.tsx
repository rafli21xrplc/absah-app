import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspaceProvider } from '@/lib/workspace';

export const metadata: Metadata = { title: 'Portal' };

// The signed-in portal (PWA siswa, ORT-02). Without a session: WhatsApp OTP login.
export default function SignedInPortalLayout({ children }: { children: ReactNode }) {
  return <WorkspaceProvider signInPath="/masuk/hp">{children}</WorkspaceProvider>;
}
