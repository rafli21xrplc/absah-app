import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { plusJakarta } from './fonts';

export const metadata: Metadata = {
  title: { default: 'Absah', template: '%s · Absah' },
  description: 'Presensi sekolah yang sah dan rapi.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={plusJakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
