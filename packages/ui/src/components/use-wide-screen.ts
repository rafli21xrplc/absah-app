'use client';

import { useSyncExternalStore } from 'react';

/** From this width the side menu is on screen and a dropdown opens as a popover; under it the phone's own controls are easier. */
export const WIDE = '(min-width: 1024px)';

function subscribe(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => undefined;
  const query = matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** False on the server and during hydration, so the page first arrives in its small-screen form and upgrades after mount. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => typeof matchMedia === 'function' && matchMedia(WIDE).matches, () => false);
}

/** 1024 to 1279 px: the side menu shrinks to a 72 px column of icons (labels as tooltips and accessible names). */
export const RAIL = '(min-width: 1024px) and (max-width: 1279px)';

function subscribeRail(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => undefined;
  const query = matchMedia(RAIL);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True while the side menu is the icon rail. False on the server (the CSS still draws the rail; this only opens every group). */
export function useRailScreen(): boolean {
  return useSyncExternalStore(subscribeRail, () => typeof matchMedia === 'function' && matchMedia(RAIL).matches, () => false);
}
