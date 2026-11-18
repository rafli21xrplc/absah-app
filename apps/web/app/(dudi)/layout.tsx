import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspaceProvider } from '@/lib/workspace';

export const metadata: Metadata = { title: 'Pembimbing industri' };

// Industry supervisor portal for PKL (SMK, PKL-02): WhatsApp OTP login, access ends with the placements.
export default function DudiLayout({ children }: { children: ReactNode }) {
  return <WorkspaceProvider signInPath="/masuk/hp">{children}</WorkspaceProvider>;
}
