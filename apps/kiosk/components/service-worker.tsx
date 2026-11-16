'use client';

import { useEffect } from 'react';

/** Registers public/sw.js in production builds so the kiosk opens without a network (GRB-03). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
