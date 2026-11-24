'use client';

import { Check } from 'lucide-react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { Spinner } from './spinner';

export type StepStatus = 'waiting' | 'running' | 'done';

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

export interface StepListProps {
  steps: readonly Step[];
  /** Accessible name of the list, e.g. "Menyiapkan Beranda". */
  label: string;
  className?: string;
}

const WORD: Record<StepStatus, string> = {
  waiting: messages.motion.stepWaiting,
  running: messages.motion.stepRunning,
  done: messages.motion.stepDone,
};

/**
 * Steps that follow real progress (Motion-UI 4): the page sets each status when the work behind it is done, so the list never
 * pretends. A ring turns on the running step and a tick pops in when it is done. Each step also has its status in words.
 */
export function StepList({ steps, label, className }: StepListProps) {
  return (
    <ol aria-label={label} className={cx('m-0 flex list-none flex-col gap-3 p-0', className)}>
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-3">
          <span aria-hidden className="relative flex size-6 shrink-0 items-center justify-center">
            {step.status === 'running' && <Spinner />}
            {step.status === 'done' && (
              <span className="motion-pop flex size-6 items-center justify-center rounded-full bg-papan text-on-papan">
                <Check strokeWidth={2.5} className="size-4" />
              </span>
            )}
            {step.status === 'waiting' && <span className="size-4 rounded-full border-2 border-garis-kuat" />}
          </span>
          <span className={cx('text-body-strong', step.status === 'done' ? 'text-tinta' : 'text-tinta-muted')}>
            {step.label}
            <span className="sr-only">: {WORD[step.status]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
