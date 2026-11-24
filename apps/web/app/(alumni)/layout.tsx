import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Tracer study for alumni (PKL-05): opened from a WhatsApp link, no login, no service worker. The token sits in the #fragment.
export const metadata: Metadata = {
  title: 'Kabar alumni',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function AlumniLayout({ children }: { children: ReactNode }) {
  return children;
}
