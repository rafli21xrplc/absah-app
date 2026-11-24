import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The same rules as components/conventions.test.ts, over every page and screen of the apps. A class that does not exist in
// tokens.css produces no style at all and no error (text-h3 did this in three pages), so a reviewer cannot see it by eye.
const root = join(__dirname, '..', '..', '..');
const SKIP = new Set(['node_modules', '.next', 'out', 'storybook-static', 'dist']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx$/.test(name) && !/\.(test|stories)\.tsx$/.test(name) ? [path] : [];
  });
}

const files = [join(root, 'apps/web/app'), join(root, 'apps/kiosk/app'), join(root, 'apps/kiosk/components'), join(root, 'packages/ui/src/features'), join(root, 'packages/ui/src/components')]
  .flatMap((d) => (statSync(d, { throwIfNoEntry: false })?.isDirectory() ? walk(d) : []))
  .map((path) => ({ file: relative(root, path), code: readFileSync(path, 'utf8') }));

const tokens = readFileSync(join(__dirname, 'tokens.css'), 'utf8');
const TEXT_SIZES = new Set([...tokens.matchAll(/--text-([a-z0-9-]+):/g)].map((m) => m[1] ?? '').filter((n) => !n.includes('--')));
const COLORS = new Set([...tokens.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1] ?? ''));
const FAMILY = 'tinta|kapur|papan|garis|hadir|telat|izin|sakit|alpa|stabilo|on';

describe('pages use tokens that exist', () => {
  it('finds the sources', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(TEXT_SIZES.has('h2')).toBe(true);
    expect(COLORS.has('tinta-muted')).toBe(true);
  });

  it('every text-* size class is defined in tokens.css', () => {
    const bad = files.flatMap(({ file, code }) =>
      [...code.matchAll(/\btext-(display|h\d|body-strong|body|small|angka|caption|xs|sm|base|lg|xl|2xl|3xl)\b/g)].filter((m) => !TEXT_SIZES.has(m[1] ?? '')).map((m) => `${file}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });

  it('every colour class of our palette is defined in tokens.css', () => {
    const bad = files.flatMap(({ file, code }) =>
      [...code.matchAll(new RegExp(`\\b(?:text|bg|border|ring|outline|fill|stroke|accent|divide|from|to|via)-((?:${FAMILY})(?:-[a-z]+)*)(?:/\\d+)?(?![\\w-])`, 'g'))]
        .filter((m) => !COLORS.has(m[1] ?? ''))
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });
});

// Pages already moved to messages/id.ts. Text typed straight into JSX is how copy ends up spread over hundreds of files, so these
// stay clean; the other pages join this list when they are restyled (docs/ui/SLICING_PLAN.md, U9a).
const MOVED = [
  'apps/web/app/(staf)/dasbor/page.tsx',
  'apps/web/app/(staf)/dasbor/leave-section.tsx',
  'apps/web/app/(staf)/siswa/page.tsx',
  'apps/web/app/(staf)/rombel/page.tsx',
  'apps/web/app/(staf)/mapel',
  'apps/web/app/(staf)/jadwal/page.tsx',
  'apps/web/app/(staf)/jadwal/grid.tsx',
  'apps/web/app/(staf)/jadwal/homeroom.tsx',
  'apps/web/app/(staf)/staf',
  'apps/web/app/(staf)/setup',
  'apps/web/app/(portal)/portal/page.tsx',
  'apps/web/app/(portal)/portal/pkl/page.tsx',
  'apps/web/app/(lapor)/lapor',
  'apps/kiosk/components/checkout-screen.tsx',
];

describe('pages already moved keep their text in messages/id.ts', () => {
  const moved = files.filter((f) => MOVED.some((m) => f.file.startsWith(m)));
  it('finds the moved pages', () => {
    expect(moved.length).toBeGreaterThanOrEqual(15);
  });
  it.each(moved)('$file has no sentence typed into JSX', ({ code }) => {
    const literals = [...code.matchAll(/>\s*([A-Z][a-z]+(?: [A-Za-z]+)+[^<>{}\n]*)\s*</g)].map((m) => m[1]);
    expect(literals).toEqual([]);
  });
});
