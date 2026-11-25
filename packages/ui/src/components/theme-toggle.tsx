'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { messages } from '../../messages/id';
import { useTheme } from '../theme';

const t = messages.theme;

/**
 * One tap between light and dark, for the page header. It flips what is on screen now, whether that came from the person's
 * choice or from the OS. The three-way choice (with Sistem) stays in the account menu.
 */
export function ThemeToggle() {
  const [preference, setTheme] = useTheme();
  // What is on screen is only known in the browser; the server and first paint assume light.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const os = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(preference === 'dark' || (preference === 'system' && os));
  }, [preference]);
  const label = dark ? t.toLight : t.toDark;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-garis bg-kapur-raised text-tinta hover:border-garis-kuat"
    >
      {dark ? <Sun aria-hidden strokeWidth={1.75} className="size-5" /> : <Moon aria-hidden strokeWidth={1.75} className="size-5" />}
    </button>
  );
}
