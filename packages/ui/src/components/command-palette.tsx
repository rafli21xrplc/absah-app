'use client';

import { Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

// cmdk and the dialog are a separate chunk: nobody pays for them until the first Ctrl+K or tap on Cari.
const loadDialog = () => import('./command-palette-dialog');
const Dialog = lazy(loadDialog);

const t = messages.search;

export interface CommandAction {
  key: string;
  label: string;
  /** Small grey text at the right ("Data sekolah"). */
  hint?: string;
  /** Decorative icon; the label always says it. */
  icon?: ReactNode;
  /** Extra words that find it ("rekap" finds "Rekap dan ekspor"; "logout" finds "Keluar"). */
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandGroupData {
  key: string;
  heading: string;
  items: readonly CommandAction[];
  /** The group was searched elsewhere (the server): it is shown as is, not filtered again by what is typed. */
  remote?: boolean;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly CommandGroupData[];
  query: string;
  onQueryChange: (query: string) => void;
  /** A search on the server is running. */
  busy?: boolean;
}

/** The palette. Nothing is rendered or downloaded until it is opened the first time. */
export function CommandPalette(props: CommandPaletteProps) {
  const [wasOpen, setWasOpen] = useState(false);
  if (props.open && !wasOpen) setWasOpen(true);
  if (!wasOpen) return null;
  return (
    <Suspense fallback={null}>
      <Dialog {...props} />
    </Suspense>
  );
}

/** Ctrl+K (Cmd+K on a Mac) opens the palette, or closes it when it is open. Stops the browser's own use of the key. */
export function useCommandShortcut(onToggle: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggle]);
}

/** "⌘K" on a Mac and "Ctrl K" elsewhere. The server and the first paint say "Ctrl K"; a Mac corrects it after mount. */
function useShortcutLabel(): string {
  const [label, setLabel] = useState('Ctrl K');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setLabel('⌘K');
  }, []);
  return label;
}

/**
 * The search field of the page header: it looks like a field, is a button, and opens the palette. Pointing at it starts
 * downloading the palette, so it is there when the click lands.
 */
export function SearchTrigger({ className, ...props }: ComponentProps<'button'>) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onPointerEnter={() => void loadDialog()}
      onFocus={() => void loadDialog()}
      {...props}
      className={cx(
        'box-border flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-garis bg-kapur-raised px-3 text-left text-body text-tinta-muted hover:border-garis-kuat',
        className,
      )}
    >
      <Search aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
      <span className="flex-1 truncate">{t.placeholder}</span>
      <kbd aria-hidden className="shrink-0 rounded-sm border border-garis bg-kapur px-2 py-1 font-sans text-small font-semibold text-tinta-muted">
        {shortcut}
      </kbd>
      <span className="sr-only">{t.open}</span>
    </button>
  );
}
