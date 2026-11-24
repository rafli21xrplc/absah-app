import { presetCapabilities } from '@absah/capabilities';
import type { Role } from '@absah/contracts';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { currentBarKey, currentItemKey, menuContext, STAFF_MENU, TEACHER_BAR, usesTeacherBar, visibleMenu } from './nav-menu';

const labels = (roles: Role[], caps = presetCapabilities('smp', false)) =>
  visibleMenu(menuContext(roles, caps)).flatMap((g) => g.items.map((i) => i.label));
const hrefs = (roles: Role[], caps = presetCapabilities('smp', false)) =>
  visibleMenu(menuContext(roles, caps)).flatMap((g) => g.items.map((i) => i.href));

describe('staff menu by role', () => {
  it('shows an admin the school data, the reports and the settings', () => {
    const h = hrefs(['admin']);
    for (const href of ['/dasbor', '/siswa', '/rombel', '/jadwal', '/rekap', '/setup', '/ekspor-data']) expect(h).toContain(href);
  });

  it('shows a plain guru far less: no school data, no settings, no dashboard', () => {
    const h = hrefs(['guru']);
    expect(h).toContain('/hari-ini');
    expect(h).toContain('/izin');
    for (const href of ['/dasbor', '/siswa', '/rombel', '/jadwal', '/setup', '/ekspor-data']) expect(h).not.toContain(href);
  });

  it('admin and guru menus differ', () => {
    expect(hrefs(['admin'])).not.toEqual(hrefs(['guru']));
    expect(hrefs(['admin']).length).toBeGreaterThan(hrefs(['guru']).length);
  });

  it('a kepsek reads data and reports but has no settings or imports', () => {
    const h = hrefs(['kepsek']);
    expect(h).toContain('/siswa');
    expect(h).toContain('/dasbor');
    expect(h).not.toContain('/setup');
    expect(h).not.toContain('/import');
  });

  it('the label can depend on the role (Koreksi presensi for deciders, Koreksi saya for the rest)', () => {
    expect(labels(['kepsek'])).toContain('Koreksi presensi');
    expect(labels(['guru'])).toContain('Koreksi saya');
  });

  it('a user with several roles gets the union', () => {
    const both = new Set(hrefs(['guru', 'bendahara']));
    for (const h of hrefs(['guru'])) expect(both.has(h)).toBe(true);
  });
});

describe('staff menu by capability, never by level', () => {
  const sd = presetCapabilities('sd', false);
  const smk = presetCapabilities('smk', false);

  it('the same admin sees different menus in an SD and an SMK, only because capabilities differ', () => {
    const forSd = hrefs(['admin'], sd);
    const forSmk = hrefs(['admin'], smk);
    expect(forSd).not.toEqual(forSmk);
    expect(forSmk).toContain('/pkl'); // pkl.enabled is on in the SMK preset
    expect(forSd).not.toContain('/pkl');
    expect(forSd).toContain('/penjemputan'); // gate.pickup is on in the SD preset
    expect(forSmk).not.toContain('/penjemputan');
  });

  it('daily mode (SD) says "Wali kelas dan jadwal" and has no per-period entries', () => {
    expect(labels(['admin'], sd)).toContain('Wali kelas dan jadwal');
    expect(hrefs(['admin'], sd)).not.toContain('/jam-siswa');
    expect(hrefs(['guru'], sd)).not.toContain('/jurnal');
  });

  it('per-period mode adds Jam siswa and Jurnal mengajar', () => {
    const per = { ...sd, 'attendance.mode': 'per_period' } as typeof sd;
    expect(hrefs(['admin'], per)).toContain('/jam-siswa');
    expect(hrefs(['guru'], per)).toContain('/jurnal');
  });

  it('a capability that is off removes the entry, it does not disable it', () => {
    const off = { ...smk, 'gate.enabled': false } as typeof smk;
    const on = { ...smk, 'gate.enabled': true } as typeof smk;
    expect(hrefs(['admin'], off)).not.toContain('/gerbang');
    expect(hrefs(['admin'], on)).toContain('/gerbang');
    for (const g of visibleMenu(menuContext(['admin'], off))) for (const i of g.items) expect(Object.keys(i)).not.toContain('disabled');
  });

  it('a madrasah (EMIS) says Impor EMIS, a Dapodik school says Impor Dapodik', () => {
    expect(labels(['admin'], presetCapabilities('smp', true))).toContain('Impor EMIS');
    expect(labels(['admin'], { ...presetCapabilities('smp', false), 'data.source': 'dapodik' } as typeof sd)).toContain('Impor Dapodik');
  });

  it('without any capability (no school yet) only the entries that need none show', () => {
    const none = visibleMenu(menuContext(['guru'], {})).flatMap((g) => g.items.map((i) => i.href));
    expect(none).toEqual(expect.arrayContaining(['/hari-ini', '/izin', '/kegiatan']));
    expect(none).not.toContain('/gerbang');
    expect(none).not.toContain('/pkl');
  });

  it('the menu source never names a school level', () => {
    const src = readFileSync(join(__dirname, 'nav-menu.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\blevel\b/i);
    expect(src).not.toMatch(/['"](sd|smp|sma|smk)['"]/);
  });
});

describe('menu shape', () => {
  const all = STAFF_MENU.flatMap((g) => g.items);

  it('keys and links are unique', () => {
    expect(new Set(all.map((i) => i.key)).size).toBe(all.length);
    expect(new Set(all.map((i) => i.href)).size).toBe(all.length);
  });

  it('every link opens a page that exists (no link to nothing)', () => {
    for (const i of all) expect(existsSync(join(__dirname, '../app/(staf)', i.href, 'page.tsx')), i.href).toBe(true);
  });

  it('keeps the board order: untitled, DATA SEKOLAH, LAPORAN, ... and Pengaturan last', () => {
    expect(STAFF_MENU[0]?.title).toBeUndefined();
    expect(STAFF_MENU[1]?.title).toBe('DATA SEKOLAH');
    expect(STAFF_MENU[2]?.title).toBe('LAPORAN');
    expect(STAFF_MENU.at(-1)?.key).toBe('pengaturan');
  });

  it('a group left empty for this user is not shown at all', () => {
    const groups = visibleMenu(menuContext(['guru'], presetCapabilities('smp', false)));
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.map((g) => g.title)).not.toContain('DATA SEKOLAH');
  });
});

describe('currentItemKey', () => {
  const groups = visibleMenu(menuContext(['admin'], { ...presetCapabilities('smk', false), 'gate.enabled': true, 'student.billing': true } as ReturnType<typeof presetCapabilities>));

  it('matches the page itself and the pages under it', () => {
    expect(currentItemKey(groups, '/siswa')).toBe('siswa');
    expect(currentItemKey(groups, '/siswa/kontak')).toBe('siswa');
    expect(currentItemKey(groups, '/gerbang/kios')).toBe('gerbang');
  });

  it('does not confuse a link with another that starts with the same letters', () => {
    expect(currentItemKey(groups, '/izin-guru')).not.toBe('izin');
    expect(currentItemKey(groups, '/tagihan-siswa')).not.toBe('tagihan');
  });

  it('nothing is current on the home page or an unknown path', () => {
    expect(currentItemKey(groups, '/')).toBeNull();
    expect(currentItemKey(groups, '/entah')).toBeNull();
  });
});

describe('teacher bottom bar', () => {
  const uses = (roles: Role[]) => usesTeacherBar(menuContext(roles, {}));

  it('is for people who only teach: guru and wali kelas', () => {
    expect(uses(['guru'])).toBe(true);
    expect(uses(['guru', 'wali_kelas'])).toBe(true);
    expect(uses(['wali_kelas', 'piket'])).toBe(true);
  });

  it('is not for anyone who manages the school, even if they also teach', () => {
    for (const role of ['admin', 'operator', 'kepsek', 'wakasek'] as Role[]) expect(uses(['guru', role]), role).toBe(false);
  });

  it('is not for people who do not teach', () => {
    expect(uses(['piket'])).toBe(false);
    expect(uses([])).toBe(false);
  });

  it('has four tabs, each with its own link and a page behind it (no link to nothing)', () => {
    expect(TEACHER_BAR).toHaveLength(4);
    expect(new Set(TEACHER_BAR.map((i) => i.href)).size).toBe(4);
    for (const i of TEACHER_BAR) {
      const dir = i.href === '/' ? '' : i.href;
      expect(existsSync(join(__dirname, '../app/(staf)', dir, 'page.tsx')), i.href).toBe(true);
    }
  });

  it('starts with Hari ini', () => expect(TEACHER_BAR[0].href).toBe('/hari-ini'));

  it('marks the tab of the page, and home only for home', () => {
    expect(currentBarKey('/hari-ini')).toBe('hari-ini');
    expect(currentBarKey('/izin/baru')).toBe('izin');
    expect(currentBarKey('/')).toBe('menu');
    expect(currentBarKey('/kegiatan')).toBeNull();
    expect(currentBarKey('/izin-guru')).toBeNull();
  });
});
