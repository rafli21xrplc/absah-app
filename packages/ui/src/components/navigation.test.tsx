// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarDays, Clock, House, User } from 'lucide-react';
import { forwardRef, useState, type AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { BottomNav, type BottomNavItem } from './bottom-nav';
import { SegmentedControl } from './segmented-control';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const icon = (I: typeof House) => <I aria-hidden strokeWidth={1.75} className="size-6" />;
const items = (current: string): [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem] => [
  { key: 'hari-ini', label: 'Hari ini', href: '/hari-ini', icon: icon(House), current: current === 'hari-ini' },
  { key: 'jadwal', label: 'Jadwal', href: '/jadwal', icon: icon(CalendarDays), current: current === 'jadwal' },
  { key: 'riwayat', label: 'Riwayat', href: '/riwayat', icon: icon(Clock), current: current === 'riwayat' },
  { key: 'akun', label: 'Akun', href: '/akun', icon: icon(User), current: current === 'akun' },
];

describe('BottomNav', () => {
  it('is a navigation landmark with four links and the current one marked', async () => {
    const { container } = render(
      <main>
        <BottomNav items={items('jadwal')} />
      </main>,
    );
    expect(screen.getByRole('navigation', { name: 'Menu utama' })).toBeTruthy();
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Hari ini', 'Jadwal', 'Riwayat', 'Akun']);
    expect(screen.getByRole('link', { name: 'Jadwal' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Akun' }).getAttribute('aria-current')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('marks the current menu by weight and a bar, not by colour alone', () => {
    render(<BottomNav items={items('akun')} />);
    const current = screen.getByRole('link', { name: 'Akun' }).className;
    expect(current).toContain('font-bold');
    expect(current).toContain('border-papan');
  });

  it('uses the link component the app passes (next/link in the app)', () => {
    const Custom = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function Custom(props, ref) {
      return <a ref={ref} data-custom="yes" {...props} />;
    });
    render(<BottomNav items={items('hari-ini')} linkAs={Custom} />);
    expect(screen.getAllByRole('link').every((a) => a.getAttribute('data-custom') === 'yes')).toBe(true);
  });

  it('every link is at least 56 px high', () => {
    render(<BottomNav items={items('hari-ini')} />);
    expect(screen.getAllByRole('link').every((a) => a.className.includes('min-h-14'))).toBe(true);
  });
});

describe('Tabs', () => {
  function Demo() {
    return (
      <main>
        <Tabs defaultValue="jadwal">
          <TabsList label="Bagian jadwal">
            <TabsTrigger value="jadwal">Jadwal pelajaran</TabsTrigger>
            <TabsTrigger value="jam">Jam pelajaran</TabsTrigger>
            <TabsTrigger value="wali">Wali kelas</TabsTrigger>
          </TabsList>
          <TabsContent value="jadwal">isi jadwal</TabsContent>
          <TabsContent value="jam">isi jam</TabsContent>
          <TabsContent value="wali">isi wali</TabsContent>
        </Tabs>
      </main>
    );
  }

  it('shows the chosen tab panel and nothing of the others', async () => {
    const { container } = render(<Demo />);
    expect(screen.getByRole('tab', { name: 'Jadwal pelajaran' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('isi jadwal');
    expect(screen.queryByText('isi jam')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('moves between tabs with the arrow keys and Tab leaves the tab list', async () => {
    render(<Demo />);
    screen.getByRole('tab', { name: 'Jadwal pelajaran' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Jam pelajaran' }));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('tabpanel').textContent).toBe('isi jam');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('tabpanel'));
  });

  it('every tab is at least 44 px high', () => {
    render(<Demo />);
    expect(screen.getAllByRole('tab').every((t) => t.className.includes('min-h-11'))).toBe(true);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'aktif', label: 'Aktif' },
    { value: 'keluar', label: 'Keluar' },
    { value: 'semua', label: 'Semua' },
  ] as const;

  it('is a named group of buttons; the chosen one is pressed', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <main>
        <SegmentedControl label="Status" options={options} value="aktif" onChange={onChange} />
      </main>,
    );
    expect(screen.getByRole('group', { name: 'Status' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aktif' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Keluar' }).getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    expect(onChange).toHaveBeenCalledWith('keluar');
    await expectNoAxeViolations(container);
  });

  it('works controlled', async () => {
    function Demo() {
      const [v, setV] = useState<(typeof options)[number]['value']>('aktif');
      return <SegmentedControl label="Status" options={options} value={v} onChange={setV} />;
    }
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Semua' }));
    expect(screen.getByRole('button', { name: 'Semua' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Aktif' }).getAttribute('aria-pressed')).toBe('false');
  });
});
