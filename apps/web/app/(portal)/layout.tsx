import { color } from '@absah/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PortalServiceWorker } from './service-worker';

// Parent and student portal plus action links, installable as a PWA (ORT-02).
export const metadata: Metadata = {
  appleWebApp: { capable: true, title: 'Absah', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: color.papan.light };

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortalServiceWorker />
      {children}
    </>
  );
}
