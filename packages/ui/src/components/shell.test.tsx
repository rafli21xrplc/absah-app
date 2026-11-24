// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarCheck, Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { AppShell, ErrorPage, LoadingPage, NotFoundPage, PortalFrame } from './frames';
import { SideNav, type SideNavGroup } from './side-nav';

const groups = (current: string): SideNavGroup[] => [
  {
    key: 'inti',
    items: [{ key: 'hari-ini', label: 'Presensi kelas', href: '/hari-ini', icon: <CalendarCheck className="size-5" />, current: current === 'hari-ini' }],
  },
  {
    key: 'data',
    title: 'DATA SEKOLAH',
    items: [
      { key: 'siswa', label: 'Siswa', href: '/siswa', icon: <Users className="size-5" />, current: current === 'siswa' },
      { key: 'rombel', label: 'Rombel', href: '/rombel', icon: <Users className="size-5" />, current: current === 'rombel' },
    ],
  },
];

describe('SideNav', () => {
  it('is a navigation landmark; the current link has aria-current="page"', async () => {
    const { container } = render(
      <main>
        <SideNav groups={groups('siswa')} />
      </main>,
    );
    expect(screen.getByRole('navigation', { name: 'Menu utama' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Siswa' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(1);
    await expectNoAxeViolations(container);
  });

  it('shows a titled group\'s heading as text and does not name the list with it (so label queries stay unambiguous)', () => {
    render(<SideNav groups={groups('hari-ini')} />);
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getByText('DATA SEKOLAH')).toBeTruthy();
    expect(screen.queryByLabelText('DATA SEKOLAH')).toBeNull();
  });

  it('marks the current item bold, filled and with a bar, not by colour alone', () => {
    render(<SideNav groups={groups('hari-ini')} />);
    const cls = screen.getByRole('link', { name: 'Presensi kelas' }).className;
    expect(cls).toContain('font-bold');
    expect(cls).toContain('border-papan');
    expect(cls).toContain('bg-papan-soft');
  });

  it('every link is at least 44 px high', () => {
    render(<SideNav groups={groups('hari-ini')} />);
    expect(screen.getAllByRole('link').every((a) => a.className.includes('min-h-11'))).toBe(true);
  });

  it('tells the page when a link is pressed (to close the sheet on a phone)', async () => {
    const onNavigate = vi.fn();
    render(<SideNav groups={groups('hari-ini')} onNavigate={onNavigate} linkAs={(p: React.ComponentProps<'a'>) => <a {...p} onClick={(e) => { e.preventDefault(); p.onClick?.(e); }} />} />);
    await userEvent.click(screen.getByRole('link', { name: 'Rombel' }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

describe('AppShell', () => {
  it('has a skip link to the content and leaves the page its own main landmark', async () => {
    const { container } = render(
      <AppShell sidebar={<SideNav groups={groups('hari-ini')} />} topBar={<span>bilah atas</span>}>
        <main>
          <h1>Hari ini</h1>
        </main>
      </AppShell>,
    );
    expect(screen.getByRole('link', { name: 'Lewati ke isi halaman' }).getAttribute('href')).toBe('#isi');
    expect(container.querySelector('#isi')).not.toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    await expectNoAxeViolations(container);
  });

  it('puts the menu in a 240 px column from 1024 px up and the top bar below it', () => {
    const { container } = render(
      <AppShell sidebar={<span>menu</span>} topBar={<span>bilah atas</span>}>
        <p>isi</p>
      </AppShell>,
    );
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('hidden');
    expect(aside?.className).toContain('lg:flex');
    expect(aside?.className).toContain('w-60');
    expect(within(container).getByText('bilah atas').parentElement?.className).toContain('lg:hidden');
  });

  it('shows no top bar when none is given', () => {
    const { container } = render(<AppShell sidebar={<span>menu</span>}>isi</AppShell>);
    expect(container.querySelector('.lg\\:hidden')).toBeNull();
  });
});

describe('PortalFrame', () => {
  it('is one column, 480 px at most', () => {
    const { container } = render(<PortalFrame>isi</PortalFrame>);
    expect((container.firstElementChild as HTMLElement).className).toContain('max-w-120');
  });
});

describe('route states', () => {
  it('the frame is box-border: without preflight, w-full plus px-4 would overflow a phone by 32 px', () => {
    const { container } = render(<LoadingPage />);
    expect((container.firstElementChild as HTMLElement).className).toContain('box-border');
  });

  it('LoadingPage is announced once as "Sedang memuat"', async () => {
    const { container } = render(<LoadingPage />);
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Sedang memuat' })).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Sedang memuat');
    await expectNoAxeViolations(container);
  });

  it('ErrorPage says the data is safe, retries, and shows nothing technical', async () => {
    const onRetry = vi.fn();
    const { container } = render(<ErrorPage onRetry={onRetry} />);
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Halaman belum bisa dibuka' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Data Anda aman');
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').textContent).not.toMatch(/error|exception|stack|500|undefined/i);
    await expectNoAxeViolations(container);
  });

  it('NotFoundPage names what happened and offers the way home as a link', async () => {
    const { container } = render(<NotFoundPage />);
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Halaman tidak ditemukan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ke beranda' }).getAttribute('href')).toBe('/');
    await expectNoAxeViolations(container);
  });
});
