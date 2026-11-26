import { cx } from '../cx';
import { initials } from './initials';

/** Five low-chroma pairs (tokens avatar-n / on-avatar-n), far from the status colours so an avatar never reads as a status. */
const PAIRS = [
  'bg-avatar-1 text-on-avatar-1',
  'bg-avatar-2 text-on-avatar-2',
  'bg-avatar-3 text-on-avatar-3',
  'bg-avatar-4 text-on-avatar-4',
  'bg-avatar-5 text-on-avatar-5',
] as const;

export type AvatarSize = 30 | 36 | 38 | 40;

const SIZE: Record<AvatarSize, string> = {
  30: 'size-[30px] text-mini',
  36: 'size-9 text-mini',
  38: 'size-[38px] text-small',
  40: 'size-10 text-small',
};

/** 0..4, stable for one seed (FNV-1a). Seeded by an ID, not the row index, so a person keeps their colour across lists. */
export function avatarPair(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % PAIRS.length;
}

export interface AvatarProps {
  name: string;
  /** Stable ID (student, member). Falls back to the name. */
  seed?: string;
  size?: AvatarSize;
  className?: string;
}

/** Two initials in a coloured circle. Decorative: the name is always written next to it. */
export function Avatar({ name, seed, size = 36, className }: AvatarProps) {
  return (
    <span
      aria-hidden
      data-pair={avatarPair(seed ?? name)}
      className={cx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold', SIZE[size], PAIRS[avatarPair(seed ?? name)], className)}
    >
      {initials(name)}
    </span>
  );
}
