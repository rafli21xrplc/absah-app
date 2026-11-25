// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarCheck, Users } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { AppShell } from './frames';
import { SideNav, type SideNavGroup } from './side-nav';
import { AccountMenu, menuItemStyles, SchoolSwitcher } from './sidebar-menus';

function widescreen(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

const groups = (current: string): SideNavGroup[] => [
  { key: 'inti', items: [{ key: 'hari-ini', label: 'Presensi kelas', href: '/hari-ini', icon: <CalendarCheck className="size-5" />, current: current === 'hari-ini' }] },
  { key: 'data', title: 'DATA SEKOLAH', items: [{ key: 'siswa', label: 'Siswa', href: '/siswa', icon: <Users className="size-5" />, current: current === 'siswa' }] },
  { key: 'laporan', title: 'LAPORAN', items: [{ key: 'rekap', label: 'Rekap dan ekspor', href: '/rekap', icon: <Users className="size-5" />, current: current === 'rekap' }] },
];

beforeEach(() => widescreen(true));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('SideNav collapsible', () => {
  it('shows the group of the current page open and the others shut, with a button on each heading', () => {
    render(<SideNav groups={groups('siswa')} collapsible />);
    expect(screen.getByRole('link', { name: 'Presensi kelas' })).toBeTruthy(); // untitled group: always there
    expect(screen.getByRole('link', { name: 'Siswa' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Rekap dan ekspor' })).toBeNull();
    expect(screen.getByRole('button', { name: 'LAPORAN' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'DATA SEKOLAH' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a group on a tap, and remembers it after a reload of the page', async () => {
    const first = render(<SideNav groups={groups('hari-ini')} collapsible />);
    await userEvent.click(screen.getByRole('button', { name: 'LAPORAN' }));
    expect(screen.getByRole('link', { name: 'Rekap dan ekspor' })).toBeTruthy();
    first.unmount();
    render(<SideNav groups={groups('hari-ini')} collapsible />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Rekap dan ekspor' })).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Siswa' })).toBeNull();
  });

  it('cannot shut the group that holds the current page', async () => {
    render(<SideNav groups={groups('siswa')} collapsible />);
    await userEvent.click(screen.getByRole('button', { name: 'DATA SEKOLAH' }));
    expect(screen.getByRole('link', { name: 'Siswa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'DATA SEKOLAH' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('without `collapsible` everything is open and the headings are plain text', () => {
    render(<SideNav groups={groups('hari-ini')} />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <main>
        <SideNav groups={groups('siswa')} collapsible />
      </main>,
    );
    await expectNoAxeViolations(container);
  });
});

const schools = [
  { id: 'a', name: 'SMA Absah Uji', detail: 'SMA' },
  { id: 'b', name: 'SMP Absah Contoh', detail: 'SMP' },
];

describe('SchoolSwitcher', () => {
  it('with one school is a plain card, nothing to press', () => {
    render(<SchoolSwitcher schools={[schools[0]!]} activeId="a" onSelect={() => undefined} />);
    expect(screen.getByText('SMA Absah Uji')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('with several, opens a list; picking another school tells the page, picking the same one does not', async () => {
    const onSelect = vi.fn();
    render(<SchoolSwitcher schools={schools} activeId="a" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /SMA Absah Uji/ }));
    const list = await screen.findByRole('dialog', { name: 'Pilih sekolah' });
    expect(within(list).getByRole('button', { name: /SMA Absah Uji/ }).getAttribute('aria-current')).toBe('true');
    await userEvent.click(within(list).getByRole('button', { name: /SMA Absah Uji/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /SMA Absah Uji/ }));
    await userEvent.click(await screen.findByRole('button', { name: /SMP Absah Contoh/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('AccountMenu', () => {
  it('names the person under the button and opens the personal things, closing on a marked row', async () => {
    const leave = vi.fn();
    render(
      <AccountMenu name="Hendra Wijaya" detail="Admin" email="hendra@absahuji.sch.id">
        <button type="button" data-menu-close className={menuItemStyles} onClick={leave}>
          Keluar
        </button>
        <button type="button" className={menuItemStyles}>
          Tema
        </button>
      </AccountMenu>,
    );
    const trigger = screen.getByRole('button', { name: /Hendra Wijaya/ });
    expect(trigger.textContent).toContain('Admin');
    await userEvent.click(trigger);
    const menu = await screen.findByRole('dialog', { name: 'Menu akun' });
    expect(within(menu).getByText('hendra@absahuji.sch.id')).toBeTruthy();
    await userEvent.click(within(menu).getByRole('button', { name: 'Tema' }));
    expect(screen.getByRole('dialog', { name: 'Menu akun' })).toBeTruthy(); // a plain row leaves it open
    await userEvent.click(within(menu).getByRole('button', { name: 'Keluar' }));
    expect(leave).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('AppShell with a pinned header and footer', () => {
  it('keeps the brand above and the account below the scrolling menu', async () => {
    const { container } = render(
      <AppShell sidebar={<SideNav groups={groups('hari-ini')} />} sidebarHeader={<span>Absah</span>} sidebarFooter={<span>Akun saya</span>}>
        <main>
          <h1>Isi</h1>
        </main>
      </AppShell>,
    );
    const aside = container.querySelector('aside')!;
    expect(within(aside).getByText('Absah')).toBeTruthy();
    expect(within(aside).getByText('Akun saya')).toBeTruthy();
    expect(aside.children).toHaveLength(3);
    expect(aside.children[1]?.className).toContain('overflow-y-auto');
    await expectNoAxeViolations(container);
  });
});
