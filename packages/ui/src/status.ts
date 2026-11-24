import { color, type ThemeName } from './tokens';

/** H Hadir, T Telat, I Izin, S Sakit, A Alpa, ? Belum diisi. The order is fixed everywhere (Sistem-UI). */
export const STATUS_CODES = ['H', 'T', 'I', 'S', 'A', '?'] as const;
export type StatusCode = (typeof STATUS_CODES)[number];

interface StatusDef {
  kata: string;
  fg: keyof typeof color;
  bg: keyof typeof color;
}

const DEFS: Record<StatusCode, StatusDef> = {
  H: { kata: 'Hadir', fg: 'hadir', bg: 'hadir-soft' },
  T: { kata: 'Telat', fg: 'telat', bg: 'telat-soft' },
  I: { kata: 'Izin', fg: 'izin', bg: 'izin-soft' },
  S: { kata: 'Sakit', fg: 'sakit', bg: 'sakit-soft' },
  A: { kata: 'Alpa', fg: 'alpa', bg: 'alpa-soft' },
  // Nobody filled it yet. The dashed border that tells it apart from the others without colour is the component's job.
  '?': { kata: 'Belum diisi', fg: 'tinta-muted', bg: 'kapur-raised' },
};

export interface StatusTokens {
  huruf: StatusCode;
  kata: string;
  /** CSS value for text and icon colour. Follows the theme. */
  fg: string;
  /** CSS value for the background. Follows the theme. */
  bg: string;
}

/** Letter, word and colours of an attendance status. Status is never colour alone: always show huruf and kata. */
export function statusTokens(code: StatusCode): StatusTokens {
  const d = DEFS[code];
  return { huruf: code, kata: d.kata, fg: `var(--${d.fg})`, bg: `var(--${d.bg})` };
}

/** The same colours as #RRGGBB for one theme, for contrast checks and for places CSS variables do not reach. */
export function statusHex(code: StatusCode, theme: ThemeName = 'light'): { fg: string; bg: string } {
  const d = DEFS[code];
  return { fg: color[d.fg][theme], bg: color[d.bg][theme] };
}
