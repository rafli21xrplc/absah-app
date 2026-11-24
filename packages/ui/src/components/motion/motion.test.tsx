// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { CheckDraw } from './check-draw';
import { CountdownRing, clock } from './countdown-ring';
import { Spinner } from './spinner';
import { StepList } from './step-list';
import { useReducedMotion } from './use-reduced-motion';
import { useShake } from './use-shake';

/** matchMedia that can change: `reduce(true)` turns "less motion" on and tells the listeners. */
function mockMotionPreference(initial: boolean) {
  let reduced = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return {
    reduce(value: boolean) {
      reduced = value;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

beforeEach(() => {
  mockMotionPreference(false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('clock', () => {
  it('writes minutes and seconds', () => {
    expect([0, 9, 12, 60, 90, 120].map(clock)).toEqual(['0:00', '0:09', '0:12', '1:00', '1:30', '2:00']);
  });
});

describe('CountdownRing', () => {
  it('counts down with the clock, calls onDone once and then stops', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<CountdownRing seconds={5} onDone={onDone} />);
    expect(screen.getByText('0:05')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByText('0:03')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops when it is taken off the page', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(<CountdownRing seconds={3} onDone={onDone} />);
    unmount();
    act(() => void vi.advanceTimersByTime(10_000));
    expect(onDone).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts again when the seconds change', () => {
    vi.useFakeTimers();
    const { rerender } = render(<CountdownRing seconds={5} />);
    act(() => void vi.advanceTimersByTime(3000));
    rerender(<CountdownRing seconds={60} />);
    expect(screen.getByText('1:00')).toBeTruthy();
  });

  it('tells a screen reader the start, the last 10 seconds and the end, not every second', () => {
    vi.useFakeTimers();
    render(<CountdownRing seconds={30} />);
    const said: string[] = [];
    const note = () => {
      const text = screen.getByRole('status').textContent ?? '';
      if (said.at(-1) !== text) said.push(text);
    };
    note();
    for (let i = 0; i < 31; i += 1) {
      act(() => void vi.advanceTimersByTime(1000));
      note();
    }
    expect(said).toEqual(['Sisa waktu 0:30.', 'Tinggal 10 detik.', 'Waktu habis.']);
  });

  it('draws no ring with less motion, but the number keeps running', () => {
    vi.useFakeTimers();
    const pref = mockMotionPreference(true);
    const { container } = render(<CountdownRing seconds={4} />);
    expect(container.querySelector('svg')).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText('0:03')).toBeTruthy();
    pref.reduce(false);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('useShake', () => {
  it('shakes nothing at first, then alternates the class on every new wrong answer', () => {
    const { result, rerender } = renderHook(({ n }) => useShake(n), { initialProps: { n: 0 } });
    expect(result.current).toBe('');
    rerender({ n: 1 });
    expect(result.current).toBe('motion-shake-a');
    rerender({ n: 2 });
    expect(result.current).toBe('motion-shake-b');
    rerender({ n: 3 });
    expect(result.current).toBe('motion-shake-a');
    rerender({ n: 3 });
    expect(result.current).toBe('motion-shake-a');
  });

  it('a counter that goes back to 0 does not shake', () => {
    const { result, rerender } = renderHook(({ n }) => useShake(n), { initialProps: { n: 1 } });
    expect(result.current).toBe('');
    rerender({ n: 0 });
    expect(result.current).toBe('');
  });
});

describe('useReducedMotion', () => {
  it('reads the setting and follows it', () => {
    const pref = mockMotionPreference(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    pref.reduce(true);
    expect(result.current).toBe(true);
  });
});

describe('Spinner', () => {
  it('turns, and is just "…" with less motion', () => {
    const pref = mockMotionPreference(false);
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg.motion-spin')).not.toBeNull();
    pref.reduce(true);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('…');
  });
});

describe('StepList', () => {
  it('says each step in words as well as by its picture, and passes axe', async () => {
    const { container } = render(
      <StepList
        label="Menyiapkan Beranda"
        steps={[
          { id: 'a', label: 'Akun dikenali', status: 'done' },
          { id: 'b', label: 'Membuka SMA Absah Uji', status: 'running' },
          { id: 'c', label: 'Menyiapkan jadwal hari ini', status: 'waiting' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Akun dikenali: selesai', 'Membuka SMA Absah Uji: sedang berjalan', 'Menyiapkan jadwal hari ini: menunggu']);
    expect(screen.getByRole('list', { name: 'Menyiapkan Beranda' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('CheckDraw', () => {
  it('is decoration only', async () => {
    const { container } = render(<CheckDraw />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await expectNoAxeViolations(container);
  });
});
