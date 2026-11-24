import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Kanal lapor TPPK (KSW-06): public, no login, opened from the school's QR poster. No service worker,
// no stored state: a shared phone should keep no trace of a report.
export const metadata: Metadata = {
  title: 'Lapor ke TPPK sekolah',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function LaporLayout({ children }: { children: ReactNode }) {
  return children;
}
