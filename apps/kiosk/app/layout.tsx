import '@absah/ui/tokens.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/service-worker';

export const metadata: Metadata = { title: 'Kios Absah' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f172a' };

export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
