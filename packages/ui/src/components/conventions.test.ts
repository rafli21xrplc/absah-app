import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Rules from CLAUDE.md ("UI Absah: aturan tetap") that a reviewer would otherwise have to catch by eye.
const dir = __dirname;
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.endsWith('.stories.tsx') && f !== 'story-helpers.tsx')
  .map((f) => ({ file: f, code: readFileSync(join(dir, f), 'utf8') }));

// Tailwind classes from tokens.json only: these names do not exist (text-h3, text-caption) or are not allowed.
const TEXT_TOKENS = ['display', 'h1', 'h2', 'body', 'body-strong', 'small', 'angka'];

describe('components use tokens only', () => {
  it('finds the component sources', () => {
    expect(sources.length).toBeGreaterThanOrEqual(8);
  });

  it.each(sources)('$file has no arbitrary font sizes, half-step spacing or hex colours', ({ code }) => {
    expect(code.match(/\btext-\[[^\]]+\]/g) ?? []).toEqual([]);
    expect(code.match(/\bleading-\[[^\]]+\]/g) ?? []).toEqual([]);
    expect(code.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|size|h|w|min-h|min-w)-\d+\.\d+\b/g) ?? []).toEqual([]);
    expect(code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it.each(sources)('$file only uses text sizes that exist in tokens.json', ({ code }) => {
    const used = [...code.matchAll(/\btext-(display|h\d|body-strong|body|small|angka|caption|xs|sm|base|lg|xl)\b/g)].map((m) => m[1]);
    expect(used.filter((u) => !TEXT_TOKENS.includes(u ?? ''))).toEqual([]);
  });
});
