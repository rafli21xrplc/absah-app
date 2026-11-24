'use client';

import { useEffect, useRef, useState } from 'react';
import { messages } from '../../../messages/id';
import { fill } from '../../fill';
import { cx } from '../../cx';
import { useReducedMotion } from './use-reduced-motion';

export interface CountdownRingProps {
  /** Whole seconds to count down from. Changing it starts again. */
  seconds: number;
  /** Called once, when the time is up. */
  onDone?: () => void;
  /** px of the ring. */
  size?: number;
  className?: string;
}

/** 90 -> "1:30", 12 -> "0:12". */
export function clock(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const RADIUS = 10;
const LENGTH = 2 * Math.PI * RADIUS;
/** The last seconds a screen reader is told about, once. */
const LAST = 10;

/**
 * Ring and number from one clock (Motion-UI 5). The time left is read from a deadline, so a tab that slept still shows the truth.
 * A screen reader hears the start, the last 10 seconds and the end, never every second. With less motion only the number runs.
 */
export function CountdownRing(props: CountdownRingProps) {
  // A new `seconds` is a new countdown: the inner part starts from scratch (no state to reset by hand).
  return <Countdown key={props.seconds} {...props} />;
}

function Countdown({ seconds, onDone, size = 24, className }: CountdownRingProps) {
  const reduced = useReducedMotion();
  const [left, setLeft] = useState(seconds);
  const [spoken, setSpoken] = useState(() => fill(messages.motion.countdownStart, { time: clock(seconds) }));
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const endsAt = Date.now() + seconds * 1000;
    let finished = false;
    let announcedLast = false;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (!announcedLast && remaining <= LAST && remaining > 0 && seconds > LAST) {
        announcedLast = true;
        setSpoken(fill(messages.motion.countdownLast, { n: remaining }));
      }
      if (remaining === 0 && !finished) {
        finished = true;
        clearInterval(timer);
        setSpoken(messages.motion.countdownDone);
        done.current?.();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);

  const offset = LENGTH * (1 - (seconds > 0 ? left / seconds : 0));
  return (
    <span className={cx('inline-flex items-center gap-2 text-body-strong tabular-nums text-tinta', className)}>
      {!reduced && (
        <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" className="-rotate-90">
          <circle cx="12" cy="12" r={RADIUS} strokeWidth="3" className="stroke-garis" />
          <circle cx="12" cy="12" r={RADIUS} strokeWidth="3" strokeLinecap="round" strokeDasharray={LENGTH} strokeDashoffset={offset} className="motion-ring stroke-papan" />
        </svg>
      )}
      <span aria-hidden>{clock(left)}</span>
      <span role="status" className="sr-only">
        {spoken}
      </span>
    </span>
  );
}
