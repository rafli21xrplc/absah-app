import './globals.css';
import type { Metadata, Viewport } from 'next';
import { THEME_INIT_SCRIPT } from '@absah/ui';
import type { ReactNode } from 'react';
import { plusJakarta } from './fonts';

export const metadata: Metadata = {
  title: { default: 'Absah', template: '%s · Absah' },
  description: 'Presensi sekolah yang sah dan rapi.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme on <html> before React hydrates it.
    <html lang="id" className={plusJakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
