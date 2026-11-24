'use client';

import { useEffect } from 'react';

/** Registers public/portal-sw.js in production builds (dev reloads must not be cached). */
export function PortalServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/portal-sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
