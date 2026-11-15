import '@absah/ui/tokens.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Kios Absah' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
