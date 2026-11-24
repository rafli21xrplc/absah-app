import './globals.css';
import { color } from '@absah/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/service-worker';
import { plusJakarta } from './fonts';

export const metadata: Metadata = { title: 'Kios Absah' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: color['papan-deep'].light };

export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={plusJakarta.variable}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
