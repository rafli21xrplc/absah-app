import { describe, expect, it } from 'vitest';
import { newestFirst, parseInline, parseRelease, seenKey, unseenReleases, type Release } from './changelog';

const release = (id: string, date: string): Release => ({ id, title: id, date, blocks: [] });

describe('changelog (PLT-08)', () => {
  it('splits **bold** from plain words and leaves an unclosed marker as written', () => {
    expect(parseInline('a **b** c')).toEqual([{ text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c', bold: false }]);
    expect(parseInline('**awal** saja')).toEqual([{ text: 'awal', bold: true }, { text: ' saja', bold: false }]);
    expect(parseInline('tanpa **penutup')).toEqual([{ text: 'tanpa **penutup', bold: false }]);
    expect(parseInline('')).toEqual([]);
  });

  it('reads the front matter and the blocks: headings, paragraphs and lists', () => {
    const r = parseRelease(
      '2026-11-23-uji.md',
      ['---', 'title: Uji', 'date: 2026-11-23', '---', 'Paragraf satu', 'lanjutannya.', '', '## Judul', '- satu **tebal**', '- dua', '', 'Penutup'].join('\n'),
    );
    expect(r).toEqual({
      id: '2026-11-23-uji',
      title: 'Uji',
      date: '2026-11-23',
      blocks: [
        { kind: 'paragraph', parts: [{ text: 'Paragraf satu lanjutannya.', bold: false }] },
        { kind: 'heading', text: 'Judul' },
        { kind: 'list', items: [[{ text: 'satu ', bold: false }, { text: 'tebal', bold: true }], [{ text: 'dua', bold: false }]] },
        { kind: 'paragraph', parts: [{ text: 'Penutup', bold: false }] },
      ],
    });
  });

  it('never turns markup into HTML: it stays text', () => {
    const r = parseRelease('a.md', '---\ntitle: T\ndate: 2026-01-01\n---\n<script>alert(1)</script> [x](javascript:alert(1))');
    expect(r?.blocks).toEqual([{ kind: 'paragraph', parts: [{ text: '<script>alert(1)</script> [x](javascript:alert(1))', bold: false }] }]);
  });

  it('refuses a file without title, with a bad date, or without front matter', () => {
    expect(parseRelease('a.md', 'tanpa front matter')).toBeNull();
    expect(parseRelease('a.md', '---\ndate: 2026-01-01\n---\nisi')).toBeNull();
    expect(parseRelease('a.md', '---\ntitle: T\ndate: 1 Januari\n---\nisi')).toBeNull();
    expect(parseRelease('a.md', '---\ntitle: T\ndate: 2026-01-01\nisi tanpa penutup')).toBeNull();
    expect(parseRelease('a.md', '---\r\ntitle: T\r\ndate: 2026-01-01\r\n---\r\nisi')?.title).toBe('T');
  });

  it('orders newest first, by date and then by file name', () => {
    const sorted = newestFirst([release('a', '2026-01-01'), release('c', '2026-03-01'), release('b', '2026-03-01')]);
    expect(sorted.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('shows what is newer than the last release seen; a newcomer gets only the newest', () => {
    const all = [release('r1', '2026-01-01'), release('r2', '2026-02-01'), release('r3', '2026-03-01')];
    expect(unseenReleases(all, 'r1').map((r) => r.id)).toEqual(['r3', 'r2']);
    expect(unseenReleases(all, 'r3')).toEqual([]);
    expect(unseenReleases(all, null).map((r) => r.id)).toEqual(['r3']);
    expect(unseenReleases(all, 'sudah-dihapus').map((r) => r.id)).toEqual(['r3']);
    expect(unseenReleases([], null)).toEqual([]);
  });

  it('keeps one seen marker per user', () => {
    expect(seenKey('u1')).not.toBe(seenKey('u2'));
  });
});
