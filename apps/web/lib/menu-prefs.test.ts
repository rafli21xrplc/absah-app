import { Calendar, Home, Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { addGroup, arrangeMenu, EMPTY_PREFS, moveGroup, movePinned, moveToGroup, parsePrefs, removeGroup, setHidden, togglePin } from './menu-prefs';
import type { VisibleGroup } from './nav-menu';

const item = (key: string) => ({ key, label: key, href: `/${key}`, icon: Home });
const BASE: VisibleGroup[] = [
  { key: 'utama', items: [item('hari-ini'), item('presensi')] },
  { key: 'data', title: 'DATA SEKOLAH', items: [{ ...item('siswa'), icon: Users }, { ...item('jadwal'), icon: Calendar }, item('rombel')] },
];
const keys = (groups: { key: string; items: { key: string }[] }[]) => groups.map((g) => [g.key, g.items.map((i) => i.key)]);

describe('arrangeMenu (V12)', () => {
  it('leaves the standard menu alone without preferences', () => {
    const { groups, hidden } = arrangeMenu(BASE, EMPTY_PREFS, 'Disematkan');
    expect(keys(groups)).toEqual(keys(BASE));
    expect(groups.every((g) => g.kind === 'base')).toBe(true);
    expect(hidden).toEqual([]);
  });

  it('puts pinned items first in pinned order, then own groups, then the rest; every item once', () => {
    let p = togglePin(EMPTY_PREFS, 'rombel');
    p = togglePin(p, 'hari-ini');
    p = addGroup(p, 'Harian', 'g1');
    p = moveToGroup(p, 'siswa', 'g1');
    const { groups } = arrangeMenu(BASE, p, 'Disematkan');
    expect(keys(groups)).toEqual([
      ['disematkan', ['rombel', 'hari-ini']],
      ['grup-g1', ['siswa']],
      ['utama', ['presensi']],
      ['data', ['jadwal']],
    ]);
    expect(groups[0]?.title).toBe('Disematkan');
    expect(groups.map((g) => g.kind)).toEqual(['pinned', 'custom', 'base', 'base']);
  });

  it('hides items and drops groups left empty', () => {
    let p = setHidden(EMPTY_PREFS, 'hari-ini', true);
    p = setHidden(p, 'presensi', true);
    const { groups, hidden } = arrangeMenu(BASE, p, 'Disematkan');
    expect(keys(groups)).toEqual([['data', ['siswa', 'jadwal', 'rombel']]]);
    expect(hidden.map((i) => i.key)).toEqual(['hari-ini', 'presensi']);
  });

  it('skips keys the person can no longer see (a role taken away)', () => {
    const p = parsePrefs({ pinned: ['tagihan', 'siswa'], hidden: ['tppk'], groups: [{ id: 'g', title: 'X', items: ['bk'] }] });
    const { groups, hidden } = arrangeMenu(BASE, p, 'Disematkan');
    expect(groups[0]?.items.map((i) => i.key)).toEqual(['siswa']);
    expect(groups.some((g) => g.kind === 'custom')).toBe(false);
    expect(hidden).toEqual([]);
  });
});

describe('menu preference changes', () => {
  it('pinning takes an item out of its group and shows it again; grouping unpins it', () => {
    let p = addGroup(EMPTY_PREFS, 'Harian', 'g1');
    p = moveToGroup(setHidden(p, 'siswa', true), 'siswa', 'g1');
    p = togglePin(p, 'siswa');
    expect(p.pinned).toEqual(['siswa']);
    expect(p.hidden).toEqual([]);
    expect(p.groups[0]?.items).toEqual([]);
    p = moveToGroup(p, 'siswa', 'g1');
    expect(p.pinned).toEqual([]);
    expect(p.groups[0]?.items).toEqual(['siswa']);
    expect(moveToGroup(p, 'siswa', null).groups[0]?.items).toEqual([]);
  });

  it('orders pinned items and groups, ignoring moves past the ends', () => {
    let p = togglePin(togglePin(EMPTY_PREFS, 'a'), 'b');
    p = movePinned(p, 'b', -1);
    expect(p.pinned).toEqual(['b', 'a']);
    expect(movePinned(p, 'b', -1).pinned).toEqual(['b', 'a']);
    p = addGroup(addGroup(p, 'Satu', '1'), 'Dua', '2');
    expect(moveGroup(p, '2', -1).groups.map((g) => g.id)).toEqual(['2', '1']);
    expect(moveGroup(p, '2', 1).groups.map((g) => g.id)).toEqual(['1', '2']);
    expect(removeGroup(p, '1').groups.map((g) => g.id)).toEqual(['2']);
  });

  it('refuses a blank group name and trims long ones', () => {
    expect(addGroup(EMPTY_PREFS, '   ', 'x')).toBe(EMPTY_PREFS);
    expect(addGroup(EMPTY_PREFS, `  ${'a'.repeat(40)} `, 'x').groups[0]?.title).toHaveLength(30);
  });
});

describe('parsePrefs', () => {
  it('turns anything malformed into the default', () => {
    expect(parsePrefs(null)).toEqual(EMPTY_PREFS);
    expect(parsePrefs('x')).toEqual(EMPTY_PREFS);
    expect(parsePrefs({ pinned: 'a', hidden: [1, 'b', 'b'], groups: [{ id: 1 }, { id: 'g', title: ' ' }, null] })).toEqual({ version: 1, pinned: [], hidden: ['b'], groups: [] });
  });

  it('keeps an item in one place: a grouped item is not also pinned', () => {
    const p = parsePrefs({ pinned: ['a', 'b'], groups: [{ id: 'g', title: 'G', items: ['a'] }] });
    expect(p.pinned).toEqual(['b']);
  });
});
