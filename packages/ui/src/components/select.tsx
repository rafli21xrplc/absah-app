'use client';

import { ChevronDown } from 'lucide-react';
import { lazy, Suspense, useMemo, useSyncExternalStore, type SelectHTMLAttributes } from 'react';
import { cx } from '../cx';
import { borderClass, controlClass, useControl } from './field';
import { readSections } from './select-sections';

/** From this width a dropdown opens as a popover; under it the phone's own picker is easier to use. */
const WIDE = '(min-width: 1024px)';
// The popover (Radix, cmdk, floating-ui: ~35 kB) is a separate chunk. The page arrives with the native select and only a wide
// screen downloads it, so no page pays for it on first load.
const PopoverSelect = lazy(() => import('./select-popover'));

function subscribe(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => undefined;
  const query = matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
/** False on the server and during hydration, so the page first arrives with the native select and upgrades after mount. */
function useWideScreen() {
  return useSyncExternalStore(subscribe, () => typeof matchMedia === 'function' && matchMedia(WIDE).matches, () => false);
}

/**
 * A dropdown. Same props as the browser's <select> (value, onChange, name, <option> children), so pages do not change.
 * Laptop (>= 1024 px): a popover with the choices (a search box from 8 choices up). Phone: the browser's own picker, the
 * easiest control on a cheap Android. A real <select> stays in the page in both cases: it carries name, required and
 * the change event, so forms and onChange behave the same.
 */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const wide = useWideScreen();
  const sections = useMemo(() => readSections(children), [children]);
  if (!wide || sections === null) return <NativeSelect className={className} {...props}>{children}</NativeSelect>;
  return (
    <Suspense fallback={<NativeSelect className={className} {...props}>{children}</NativeSelect>}>
      <PopoverSelect sections={sections} className={className} {...props}>
        {children}
      </PopoverSelect>
    </Suspense>
  );
}

function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const c = useControl(props);
  return (
    <span className="relative block">
      <select
        {...props}
        id={c.id}
        aria-describedby={c['aria-describedby']}
        aria-invalid={c['aria-invalid']}
        className={cx(controlClass, 'min-h-12 cursor-pointer appearance-none pr-10', borderClass(c.invalid), className)}
      >
        {children}
      </select>
      <ChevronDown aria-hidden strokeWidth={1.75} className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-tinta-muted" />
    </span>
  );
}

