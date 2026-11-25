'use client';

import { useSyncExternalStore } from 'react';
import { THEME_KEY } from './theme-script';

/**
 * The person's choice of theme (TL1). "system" follows the OS (prefers-color-scheme); "light" and "dark" are set as
 * data-theme on <html>, which tokens.css reads. The choice lives in localStorage of this browser: it is a preference of the
 * device, not of the account, and reading it needs no request, so the page never waits for it.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const CHANGE_EVENT = 'absah-tema-berubah';

export function parseTheme(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function readTheme(): ThemePreference {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    // Private mode or blocked storage: the OS decides.
    return 'system';
  }
}

/** Sets or clears data-theme on <html>. "system" removes it so the OS decides again. */
export function applyTheme(preference: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

export function saveTheme(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch {
    // The choice still applies to this visit.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  // "storage" fires in the other tabs, so a change in one tab shows in all of them.
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The saved choice and a setter. The server render says "system"; the browser corrects it right after hydration. */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribe, readTheme, () => 'system' as const);
  return [preference, saveTheme];
}
