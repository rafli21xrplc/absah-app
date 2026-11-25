'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** False while the device says it has no connection. On the server it is true, so nothing flashes "no signal" before the first check. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
