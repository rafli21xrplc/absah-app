// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { AppLoading, LoadingState } from './loading-state';

describe('LoadingState (V13)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says what is loading at once, shows the shape after 200 ms, never a bare "Memuat…"', () => {
    const { container } = render(<LoadingState variant="table" label="Memuat rekap" count={3} />);
    expect(screen.getByRole('status').textContent).toBe('Memuat rekap');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
    void act(() => vi.advanceTimersByTime(200));
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(8);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('says the connection seems slow after 8 s and offers Muat ulang after 20 s', () => {
    render(<LoadingState />);
    expect(screen.queryByText(/koneksi sepertinya lambat/)).toBeNull();
    void act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByText(/koneksi sepertinya lambat/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Muat ulang' })).toBeNull();
    void act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeTruthy();
  });

  it.each(['rows', 'table', 'cards', 'detail'] as const)('%s has no axe violations', async (variant) => {
    const { container } = render(
      <main>
        <LoadingState variant={variant} />
      </main>,
    );
    void act(() => vi.advanceTimersByTime(20_000));
    vi.useRealTimers();
    await expectNoAxeViolations(container);
  });

  it('AppLoading names the app being prepared', () => {
    render(<AppLoading />);
    expect(screen.getByRole('status').textContent).toContain('Menyiapkan Absah');
  });
});
