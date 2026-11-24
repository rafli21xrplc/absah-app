// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Button } from './button';
import { Card } from './card';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { initials } from './initials';
import { ListRow } from './list-row';
import { SkeletonRows } from './skeleton';
import { StatusPill } from './status-pill';

describe('initials', () => {
  it.each([
    ['Gilang Ramadhan', 'GR'],
    ['  adinda   saraswati putri ', 'AS'],
    ['Bayu', 'BA'],
    ['', '?'],
    ['   ', '?'],
  ])('%j -> %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('Card', () => {
  it('is the element asked for, so it can sit in a list or the page outline', () => {
    const { container } = render(
      <ul>
        <Card as="li">satu</Card>
      </ul>,
    );
    expect(container.querySelector('ul > li')?.textContent).toBe('satu');
  });

  it('marks the active card with a thicker border, not only a colour', () => {
    render(<Card tone="active">sedang berlangsung</Card>);
    expect(screen.getByText('sedang berlangsung').className).toContain('border-2');
  });
});

describe('ListRow', () => {
  it('reads as name and detail; the initials are decoration', async () => {
    const { container } = render(
      <main>
        <ListRow name="Gilang Ramadhan" detail="No. absen 10" right={<StatusPill code="H" onPress={() => undefined} ariaLabel="Gilang Ramadhan: Hadir. Ketuk untuk mengubah." />} />
      </main>,
    );
    expect(screen.getByText('Gilang Ramadhan')).toBeTruthy();
    expect(screen.getByText('No. absen 10')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('GR');
    expect(screen.getByRole('button', { name: 'Gilang Ramadhan: Hadir. Ketuk untuk mengubah.' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('is at least 64 px high (a student row)', () => {
    const { container } = render(<ListRow name="Bayu Firmansyah" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('min-h-16');
  });

  it('can be a list item', () => {
    const { container } = render(
      <ul>
        <ListRow as="li" name="Citra Maharani" />
      </ul>,
    );
    expect(container.querySelector('ul > li')).not.toBeNull();
  });
});

describe('SkeletonRows', () => {
  it('is announced once as "Sedang memuat", not once per grey bar', async () => {
    const { container } = render(
      <main>
        <SkeletonRows count={3} />
      </main>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Sedang memuat');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(9);
    await expectNoAxeViolations(container);
  });
});

describe('EmptyState', () => {
  it('names what is missing, says what to do and offers one button', async () => {
    const onAction = vi.fn();
    const { container } = render(
      <main>
        <EmptyState title="Belum ada siswa di X-2" action={<Button onClick={onAction}>Impor dari Dapodik</Button>}>
          Tambahkan siswa satu per satu atau impor dari Dapodik.
        </EmptyState>
      </main>,
    );
    expect(screen.getByRole('heading', { name: 'Belum ada siswa di X-2' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Impor dari Dapodik' }));
    expect(onAction).toHaveBeenCalledOnce();
    await expectNoAxeViolations(container);
  });
});

describe('ErrorState', () => {
  it('an error is announced at once and can be retried', async () => {
    const onRetry = vi.fn();
    render(
      <main>
        <ErrorState title="Presensi belum terkirim" onRetry={onRetry}>
          Data aman di HP. Periksa sinyal, lalu coba lagi.
        </ErrorState>
      </main>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offline is announced politely and shows how many are waiting', async () => {
    const { container } = render(
      <main>
        <ErrorState kind="offline" title="Tersimpan di HP" pending={2}>
          2 presensi menunggu dikirim.
        </ErrorState>
      </main>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Menunggu · 2');
    await expectNoAxeViolations(container);
  });

  it('shows no counter when nothing waits and no button without onRetry', () => {
    render(<ErrorState kind="offline" title="Tersimpan di HP" pending={0} />);
    expect(screen.queryByText(/Menunggu/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
