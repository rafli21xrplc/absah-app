import type { NextConfig } from 'next';

// The API runs separately (absah-api). Proxying /api/* keeps one origin, so Better Auth cookies
// and CSP stay simple and no CORS is needed.
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared packages ship TypeScript source.
  transpilePackages: ['@absah/ui', '@absah/contracts', '@absah/capabilities'],
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
};

export default config;
