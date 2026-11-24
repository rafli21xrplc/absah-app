import { cx } from '../../cx';

export interface CheckDrawProps {
  /** px. */
  size?: number;
  className?: string;
}

/** The success tick, drawn left to right once (Motion-UI 3). The surrounding words say what succeeded; the picture only celebrates. */
export function CheckDraw({ size = 64, className }: CheckDrawProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className={cx('shrink-0', className)}>
      <circle cx="32" cy="32" r="30" className="fill-papan-soft" />
      <path d="M19 33 L28 42 L45 23" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="motion-draw stroke-papan" />
    </svg>
  );
}
