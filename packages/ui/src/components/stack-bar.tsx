import { cx } from '../cx';

export type StackTone = 'hadir' | 'telat' | 'izin' | 'sakit' | 'alpa' | 'papan' | 'grafik' | 'muted';

const TONE: Record<StackTone, string> = {
  hadir: 'bg-hadir',
  telat: 'bg-telat',
  izin: 'bg-izin',
  sakit: 'bg-sakit',
  alpa: 'bg-alpa',
  papan: 'bg-papan',
  grafik: 'bg-grafik-batang',
  muted: 'bg-garis-kuat',
};

export interface StackPart {
  value: number;
  label: string;
  tone: StackTone;
}

export interface StackBarProps {
  parts: StackPart[];
  /** Prefix of the spoken text, e.g. "Tidak hadir". */
  label: string;
  className?: string;
}

/** The spoken text: every part with its number, in order. */
export function stackLabel(label: string, parts: StackPart[]): string {
  return `${label}: ${parts.map((p) => `${p.label} ${p.value.toLocaleString('id-ID')}`).join(', ')}`;
}

/** Proportions of one whole, 8 px, full radius, 2 px gaps. role="img" names every part, so the colours are not the only cue. */
export function StackBar({ parts, label, className }: StackBarProps) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div role="img" aria-label={stackLabel(label, parts)} className={cx('flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-track', className)}>
      {total > 0 &&
        parts
          .filter((p) => p.value > 0)
          .map((p) => <span key={p.label} className={cx('h-full rounded-full', TONE[p.tone])} style={{ flexGrow: p.value, flexBasis: 0 }} />)}
    </div>
  );
}
