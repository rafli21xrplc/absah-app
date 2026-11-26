import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { statusTokens, type StatusCode } from '../status';

export type ChipTone = 'neutral' | 'papan' | 'stabilo' | 'hadir' | 'telat' | 'izin' | 'sakit' | 'alpa';

const TONE: Record<ChipTone, string> = {
  neutral: 'border-hairline bg-ubin text-tinta',
  papan: 'border-transparent bg-papan-soft text-papan',
  stabilo: 'border-transparent bg-stabilo-soft text-on-stabilo-soft',
  hadir: 'border-transparent bg-hadir-soft text-hadir',
  telat: 'border-transparent bg-telat-soft text-telat',
  izin: 'border-transparent bg-izin-soft text-izin',
  sakit: 'border-transparent bg-sakit-soft text-sakit',
  alpa: 'border-transparent bg-alpa-soft text-alpa',
};

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  icon?: LucideIcon;
  /** Rounded rectangle (rombel code) instead of a pill. */
  square?: boolean;
  className?: string;
  title?: string;
}

/** A short label: rombel, source, count. The text is always there; colour only supports it. */
export function Chip({ children, tone = 'neutral', icon: Icon, square = false, className, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cx(
        'box-border inline-flex h-7 max-w-full items-center gap-1 whitespace-nowrap border px-2 text-mini font-semibold',
        square ? 'rounded-sm' : 'rounded-full',
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden strokeWidth={2} className="size-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

const DOT: Record<Exclude<StatusCode, '?'>, { chip: string; dot: string }> = {
  H: { chip: 'bg-hadir-soft text-hadir', dot: 'bg-hadir' },
  T: { chip: 'bg-telat-soft text-telat', dot: 'bg-telat' },
  I: { chip: 'bg-izin-soft text-izin', dot: 'bg-izin' },
  S: { chip: 'bg-sakit-soft text-sakit', dot: 'bg-sakit' },
  A: { chip: 'bg-alpa-soft text-alpa', dot: 'bg-alpa' },
};

export interface StatusChipProps {
  code: StatusCode;
  /** Replaces the word, e.g. "Telat 14 m". It must still start with the status word. */
  label?: string;
  className?: string;
}

/** v3 status: dot + word on the status' soft colour. "Belum diisi" is a dashed outline, so it differs without colour. */
export function StatusChip({ code, label, className }: StatusChipProps) {
  const text = label ?? statusTokens(code).kata;
  const base = 'box-border inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2 text-mini font-semibold';
  if (code === '?') {
    return <span className={cx(base, 'border-[1.5px] border-dashed border-garis-kuat bg-kapur-raised text-tinta-muted', className)}>{text}</span>;
  }
  return (
    <span className={cx(base, DOT[code].chip, className)}>
      <span aria-hidden className={cx('size-2 shrink-0 rounded-full', DOT[code].dot)} />
      {text}
    </span>
  );
}
