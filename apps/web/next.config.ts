import type { NextConfig } from 'next';

// The API runs separately (absah-api). Proxying /api/* keeps one origin, so Better Auth cookies
// and CSP stay simple and no CORS is needed.
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev badge sits at the right: at the left it covers the account button at the foot of the side menu.
  devIndicators: { position: 'bottom-right' },
  // Shared packages ship TypeScript source.
  transpilePackages: ['@absah/ui', '@absah/contracts', '@absah/capabilities'],
  headers() {
    // The portal service worker must never be served stale (prompt 3.3).
    return Promise.resolve([
      {
        source: '/portal-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]);
  },
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
};

export default config;
