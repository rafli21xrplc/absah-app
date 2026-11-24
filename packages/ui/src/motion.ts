'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Soft motion: short, one easing, no bounce. Only for the staff web on wide screens (see canAnimate). */
export const MOTION = {
  duration: 0.5,
  ease: 'power2.out',
  stagger: 0.06,
  /** px a block rises while it fades in. */
  rise: 12,
  /** Bars (data-grow) take a little longer than blocks. */
  grow: 0.7,
} as const;

/** The widest phone-sized screen is 1023 px: the guru's phone never loads the animation library. */
const WIDE = '(min-width: 1024px)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/** True only on a wide screen where the person has not asked for less motion. Pure, so it is tested without a browser. */
export function canAnimate(win: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  return !win.matchMedia(REDUCED).matches && win.matchMedia(WIDE).matches;
}

/**
 * Fades blocks in and grows bars once, when `ready` becomes true. Mark the elements inside the returned container with
 * `data-reveal` (rise and fade, staggered) or `data-grow` (bar grows from the left). GSAP is loaded on demand, never in the
 * first bundle. Without animation (phone, reduced motion, library failed to load) nothing is hidden at any time: the
 * container only gets data-motion="pending" when the animation is going to run, and CSS in base.css hides the marked
 * elements for exactly that moment, so there is no flash before the first frame.
 */
export function useReveal<T extends HTMLElement>(ready: unknown): RefObject<T | null> {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !ready || !canAnimate()) return;
    root.dataset.motion = 'pending';
    let revert: (() => void) | undefined;
    let cancelled = false;
    const done = () => {
      root.dataset.motion = 'done';
    };

    import('gsap')
      .then(({ gsap }) => {
        if (cancelled) return;
        const ctx = gsap.context(() => {
          gsap.from(root.querySelectorAll('[data-reveal]'), {
            opacity: 0,
            y: MOTION.rise,
            duration: MOTION.duration,
            ease: MOTION.ease,
            stagger: MOTION.stagger,
            clearProps: 'opacity,transform',
          });
          gsap.from(root.querySelectorAll('[data-grow]'), {
            scaleX: 0,
            transformOrigin: 'left center',
            duration: MOTION.grow,
            ease: MOTION.ease,
            delay: MOTION.duration / 2,
            stagger: MOTION.stagger / 2,
            clearProps: 'transform',
          });
        }, root);
        revert = () => ctx.revert();
        // Inline styles from "from" are now in place, so the CSS hiding rule can step aside.
        done();
      })
      .catch(done);

    return () => {
      cancelled = true;
      revert?.();
      delete root.dataset.motion;
    };
  }, [ready]);

  return ref;
}
