import type { NextConfig } from 'next';

// Static export: the kiosk runs offline from a service worker (prompt 3.1). Rewrites are not
// available in static export, so the kiosk calls the API at NEXT_PUBLIC_API_URL.
const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  transpilePackages: ['@absah/ui', '@absah/contracts'],
};

export default config;
