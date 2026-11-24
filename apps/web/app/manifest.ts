import { color } from '@absah/ui/tokens';
import type { MetadataRoute } from 'next';

/** Install the portal as an app (PWA siswa, ORT-02): Android installs from this, iOS from the apple meta. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Absah — Kartu dan kehadiran',
    short_name: 'Absah',
    description: 'Kartu sekolah digital dan riwayat kehadiran.',
    id: '/portal',
    start_url: '/portal',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: color.kapur.light,
    theme_color: color.papan.light,
    lang: 'id',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
