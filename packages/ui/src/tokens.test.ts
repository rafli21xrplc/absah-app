import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildAll, CSS_OUT, SOURCE, TS_OUT } from '../scripts/build-tokens.mjs';
import { contrastRatio } from './contrast';
import { STATUS_CODES, statusHex, statusTokens, type StatusCode } from './status';
import { color, type ColorName, type ThemeName } from './tokens';

const THEMES: ThemeName[] = ['light', 'dark'];
const hex = (name: ColorName, theme: ThemeName) => color[name][theme];
const COLORED: StatusCode[] = ['H', 'T', 'I', 'S', 'A'];

interface Pair {
  what: string;
  fg: ColorName;
  bg: ColorName;
  min: number;
}

// Each row is one use in the design. `min` is WCAG AA: 4.5 for text, 3 for UI components and focus.
const PAIRS: Pair[] = [
  { what: 'Teks utama di atas kapur', fg: 'tinta', bg: 'kapur', min: 4.5 },
  { what: 'Teks utama di atas kartu', fg: 'tinta', bg: 'kapur-raised', min: 4.5 },
  { what: 'Teks pendukung di atas kapur', fg: 'tinta-muted', bg: 'kapur', min: 4.5 },
  { what: 'Teks pendukung di atas kartu', fg: 'tinta-muted', bg: 'kapur-raised', min: 4.5 },
  { what: 'Teks utama di atas papan lembut', fg: 'tinta', bg: 'papan-soft', min: 4.5 },
  { what: 'Tombol utama: teks di atas papan', fg: 'on-papan', bg: 'papan', min: 4.5 },
  { what: 'Tautan: papan di atas kapur', fg: 'papan', bg: 'kapur', min: 4.5 },
  { what: 'Tautan: papan di atas kartu', fg: 'papan', bg: 'kapur-raised', min: 4.5 },
  { what: 'Stabilo: teks di atas stabilo', fg: 'on-stabilo', bg: 'stabilo', min: 4.5 },
  { what: 'Batas kolom isian di atas kapur', fg: 'garis-kuat', bg: 'kapur', min: 3 },
  { what: 'Batas kolom isian di atas kartu', fg: 'garis-kuat', bg: 'kapur-raised', min: 3 },
  { what: 'Cincin fokus di atas kapur', fg: 'focus', bg: 'kapur', min: 3 },
  { what: 'Cincin fokus di atas kartu', fg: 'focus', bg: 'kapur-raised', min: 3 },
];

// Below the limit in tokens.json itself. Not adjusted here (prompt U1: never change a colour to make it fit); the pressed
// state of the primary button in the dark theme needs a design decision before U2 builds Button.
const KNOWN_BELOW_LIMIT: (Pair & { theme: ThemeName })[] = [
  { what: 'Tombol utama ditekan: teks di atas papan dalam', fg: 'on-papan', bg: 'papan-deep', min: 4.5, theme: 'dark' },
];

/** Printed by `CONTRAST_TABLE=1 pnpm --filter @absah/ui test`, for the PR description. */
function table(): string {
  const rows: string[] = ['| Pasangan | Tema | Rasio | Batas |', '| --- | --- | --- | --- |'];
  for (const p of PAIRS) {
    for (const t of THEMES) rows.push(`| ${p.what} | ${t} | ${contrastRatio(hex(p.fg, t), hex(p.bg, t)).toFixed(2)} | ${p.min} |`);
  }
  for (const p of KNOWN_BELOW_LIMIT) {
    rows.push(`| ${p.what} (MASALAH DESAIN) | ${p.theme} | ${contrastRatio(hex(p.fg, p.theme), hex(p.bg, p.theme)).toFixed(2)} | ${p.min} |`);
  }
  for (const code of STATUS_CODES) {
    for (const t of THEMES) {
      const c = statusHex(code, t);
      rows.push(`| Status ${code} ${statusTokens(code).kata}: teks di atas latar | ${t} | ${contrastRatio(c.fg, c.bg).toFixed(2)} | 4.5 |`);
    }
  }
  for (const code of COLORED) {
    for (const t of THEMES) {
      rows.push(`| Status ${code}: huruf putih (on-papan) di atas warna status | ${t} | ${contrastRatio(hex('on-papan', t), statusHex(code, t).fg).toFixed(2)} | 4.5 |`);
    }
  }
  return rows.join('\n');
}

if (process.env.CONTRAST_TABLE) console.info(`\n${table()}\n`);

describe('contrast', () => {
  it.each(PAIRS.flatMap((p) => THEMES.map((theme) => ({ name: `${p.what} (${theme})`, p, theme }))))('$name', ({ p, theme }) => {
    expect(contrastRatio(hex(p.fg, theme), hex(p.bg, theme))).toBeGreaterThanOrEqual(p.min);
  });

  it.each(KNOWN_BELOW_LIMIT.map((p) => ({ name: `${p.what} (${p.theme})`, p })))('masalah desain yang diketahui: $name', ({ p }) => {
    // Fails the day tokens.json fixes it: then move the pair into PAIRS and delete this entry.
    expect(contrastRatio(hex(p.fg, p.theme), hex(p.bg, p.theme))).toBeLessThan(p.min);
  });

  it.each(STATUS_CODES.flatMap((c) => THEMES.map((t) => [c, t] as const)))('status %s: teks terhadap latar sendiri minimal 4,5 : 1 (%s)', (code, theme) => {
    const c = statusHex(code, theme);
    expect(contrastRatio(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(COLORED.flatMap((c) => THEMES.map((t) => [c, t] as const)))('status %s: huruf di atas warna status minimal 4,5 : 1 (%s)', (code, theme) => {
    // Light: white. Dark: on-papan, the dark theme's own "text on a status colour".
    expect(contrastRatio(hex('on-papan', theme), statusHex(code, theme).fg)).toBeGreaterThanOrEqual(4.5);
  });

  it('garis kuat terhadap putih minimal 3 : 1', () => {
    expect(contrastRatio(hex('garis-kuat', 'light'), '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });

  it('huruf putih di atas tiap warna status (tema terang) minimal 4,5 : 1', () => {
    for (const code of COLORED) expect(contrastRatio('#FFFFFF', statusHex(code, 'light').fg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('statusTokens', () => {
  it('gives the fixed order, letter and word for every code', () => {
    expect(STATUS_CODES.map((c) => `${statusTokens(c).huruf} ${statusTokens(c).kata}`)).toEqual([
      'H Hadir',
      'T Telat',
      'I Izin',
      'S Sakit',
      'A Alpa',
      '? Belum diisi',
    ]);
  });

  it('points at theme-aware CSS variables', () => {
    expect(statusTokens('T')).toEqual({ huruf: 'T', kata: 'Telat', fg: 'var(--telat)', bg: 'var(--telat-soft)' });
    expect(statusTokens('?').fg).toBe('var(--tinta-muted)');
  });

  it('uses the colours of tokens.json', () => {
    expect(statusHex('H', 'light')).toEqual({ fg: '#1E5B4B', bg: '#E3EFEA' });
    expect(statusHex('T', 'light')).toEqual({ fg: '#9A5B00', bg: '#FBEFD9' });
    expect(statusHex('I', 'light')).toEqual({ fg: '#2F5FC4', bg: '#E6EDFB' });
    expect(statusHex('S', 'light')).toEqual({ fg: '#7A4CC2', bg: '#EFE8FA' });
    expect(statusHex('A', 'light')).toEqual({ fg: '#B53434', bg: '#FBE7E7' });
  });
});

describe('generated files', () => {
  it('tokens.ts and tokens.css are up to date with tokens.json (run pnpm tokens:build)', () => {
    const tokens: unknown = JSON.parse(readFileSync(SOURCE, 'utf8'));
    const built = buildAll(tokens);
    expect(readFileSync(TS_OUT, 'utf8')).toBe(built.ts);
    expect(readFileSync(CSS_OUT, 'utf8')).toBe(built.css);
  });

  it('every colour token has a variable in both themes and a Tailwind colour', () => {
    const css = readFileSync(CSS_OUT, 'utf8');
    for (const name of Object.keys(color)) {
      expect(css.match(new RegExp(`^\\s+--${name}: #`, 'gm'))?.length).toBe(2);
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
