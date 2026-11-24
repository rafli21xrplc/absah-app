// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { AppShell, PageMain } from './frames';
import { GreetingHeader, SessionGroup, SessionHero, SessionItem } from './today';

describe('GreetingHeader', () => {
  it('shows the date small and the greeting as the one h1', () => {
    render(<GreetingHeader date="Senin, 25 Januari 2027" greeting="Selamat pagi, Sari" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Selamat pagi, Sari');
    expect(screen.getByText('Senin, 25 Januari 2027')).toBeTruthy();
  });
  it('has no empty date line while the date is not known', () => {
    const { container } = render(<GreetingHeader date="" greeting="Selamat pagi, Sari" />);
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('SessionHero', () => {
  const hero = <SessionHero time="08.30–09.15" title="X-2 · Matematika" meta="Jam ke-3 · 25 siswa" href="/sesi/1" />;

  it('says "Sedang berlangsung" and has one link named for the session', async () => {
    const { container } = render(<main>{hero}</main>);
    expect(screen.getByText('Sedang berlangsung')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Isi presensi X-2 · Matematika' });
    expect(link.getAttribute('href')).toBe('/sesi/1');
    expect(link.textContent).toBe('Isi presensi');
    await expectNoAxeViolations(container);
  });

  it('is the only primary action: a full-width 52 px primary button', () => {
    render(hero);
    const cls = screen.getByRole('link').className;
    expect(cls).toContain('min-h-13');
    expect(cls).toContain('w-full');
    expect(cls).toContain('bg-papan');
  });

  it('the full-width button is box-border, or its padding would push it past the card on a phone', () => {
    render(hero);
    expect(screen.getByRole('link').className).toContain('box-border');
  });

  it('is outlined as the "now" card', () => {
    const { container } = render(hero);
    expect((container.querySelector('article') as HTMLElement).className).toContain('border-papan');
  });

  it('the link element can be swapped (next/link in the app)', () => {
    render(<SessionHero title="T" href="/x" linkAs={(p: React.ComponentProps<'a'>) => <a data-custom="1" {...p} />} />);
    expect(screen.getByRole('link').getAttribute('data-custom')).toBe('1');
  });
});

describe('SessionItem', () => {
  it('a session not started has no button and no state word', () => {
    render(
      <ul>
        <SessionItem variant="next" time="09.15" title="X-3 · Fisika" meta="Jam ke-4 · 25 siswa" href="/sesi/2" />
      </ul>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link').textContent).toBe('X-3 · FisikaJam ke-4 · 25 siswa09.15');
  });

  it('states are a word plus an icon, never only a colour', () => {
    const { container } = render(
      <ul>
        <SessionItem variant="unfilled" title="A" />
        <SessionItem variant="missed" title="B" />
        <SessionItem variant="locked" title="C" />
      </ul>,
    );
    for (const word of ['Belum diisi', 'Tidak diisi', 'Dikunci']) expect(screen.getByText(word)).toBeTruthy();
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
  });

  it('a session filled without signal says "Menunggu dikirim" with an icon, and stays a plain link', async () => {
    const { container } = render(
      <ul>
        <SessionItem variant="waiting" time="08.30–09.15" title="X-2 · Matematika" meta="Jam ke-3 · 25 siswa" href="/sesi/1" />
      </ul>,
    );
    expect(screen.getByText('Menunggu dikirim')).toBeTruthy();
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/sesi/1');
    expect(screen.queryByRole('button')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('a finished session carries a check that is decorative, and says what was sent', () => {
    const { container } = render(
      <ul>
        <SessionItem variant="done" time="07.00–07.45" title="XI-1 · Matematika" meta="Terkirim · 24 siswa · 1 tidak hadir" />
      </ul>,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Terkirim · 24 siswa · 1 tidak hadir')).toBeTruthy();
  });

  it('is a link only when given an href; a row never holds a button', () => {
    render(
      <ul>
        <SessionItem variant="done" title="no link" />
        <SessionItem variant="next" title="link" href="/x" />
      </ul>,
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('every row is at least 64 px high', () => {
    render(
      <ul>
        <SessionItem variant="next" title="A" href="/x" />
        <SessionItem variant="done" title="B" />
      </ul>,
    );
    for (const el of [screen.getByRole('link'), screen.getByText('B').closest('div')]) expect((el as HTMLElement).className).toContain('min-h-16');
  });
});

describe('SessionGroup', () => {
  it('is a heading and a list, and not a landmark of its own', () => {
    render(
      <SessionGroup title="Berikutnya">
        <SessionItem variant="next" title="X-3" href="/x" />
      </SessionGroup>,
    );
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Berikutnya' })).toBeTruthy();
  });
});

describe('the whole screen', () => {
  const screenOf = (
    <PageMain>
      <GreetingHeader date="Senin, 25 Januari 2027" greeting="Selamat pagi, Sari" />
      <SessionHero time="08.30–09.15" title="X-2 · Matematika" meta="Jam ke-3 · 25 siswa" href="/sesi/1" />
      <SessionGroup title="Berikutnya">
        <SessionItem variant="next" time="09.15" title="X-3 · Fisika" meta="Jam ke-4 · 25 siswa" href="/sesi/2" />
      </SessionGroup>
      <SessionGroup title="Sudah selesai">
        <SessionItem variant="done" time="07.00–07.45" title="X-1 · Matematika" meta="Terkirim · 24 siswa · 1 tidak hadir" href="/sesi/3" />
      </SessionGroup>
    </PageMain>
  );

  it('has exactly one primary action', () => {
    render(screenOf);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('link').filter((a) => a.className.includes('bg-papan'))).toHaveLength(1);
  });

  it('passes axe inside the shell with a bottom bar', async () => {
    const { container } = render(
      <AppShell sidebar={<span>menu</span>} bottomBar={<nav aria-label="Menu utama"><a href="/hari-ini">Hari ini</a></nav>}>
        {screenOf}
      </AppShell>,
    );
    await expectNoAxeViolations(container);
  });

  it('gives the page room under the bottom bar on a phone only', () => {
    const { container } = render(
      <AppShell sidebar={null} bottomBar={<span>bar</span>}>
        x
      </AppShell>,
    );
    expect((container.querySelector('#isi') as HTMLElement).className).toContain('pb-14');
    expect((container.querySelector('#isi') as HTMLElement).className).toContain('lg:pb-0');
    expect(screen.getByText('bar').parentElement?.className).toContain('lg:hidden');
  });

  it('adds no room when there is no bottom bar', () => {
    const { container } = render(<AppShell sidebar={null}>x</AppShell>);
    expect((container.querySelector('#isi') as HTMLElement).className).not.toContain('pb-14');
  });
});
