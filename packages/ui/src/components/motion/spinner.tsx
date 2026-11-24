'use client';

import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { useReducedMotion } from './use-reduced-motion';

export interface SpinnerProps {
  /** On a green (primary) button the arc is white. */
  tone?: 'papan' | 'on-papan';
  /** px. */
  size?: number;
  className?: string;
}

/** A turning ring (Motion-UI 2). It is decoration: the button or line next to it says what is going on. With less motion it is "…". */
export function Spinner({ tone = 'papan', size = 20, className }: SpinnerProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <span aria-hidden className={cx('inline-block text-center font-bold leading-none', tone === 'on-papan' ? 'text-on-papan' : 'text-papan', className)} style={{ width: size }}>
        {messages.motion.working}
      </span>
    );
  }
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" className={cx('motion-spin shrink-0', className)}>
      <circle cx="12" cy="12" r="9" strokeWidth="3" className={tone === 'on-papan' ? 'stroke-on-papan/35' : 'stroke-garis'} />
      <path d="M12 3 a9 9 0 0 1 9 9" strokeWidth="3" strokeLinecap="round" className={tone === 'on-papan' ? 'stroke-on-papan' : 'stroke-papan'} />
    </svg>
  );
}
