// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Avatar, avatarPair } from './avatar';
import { Chip, StatusChip } from './chip';
import { DeltaPill, deltaOf } from './delta-pill';
import { StackBar, stackLabel } from './stack-bar';
import { ProgressBar } from './progress-bar';

describe('avatarPair', () => {
  it('is stable for a seed and stays in 0..4', () => {
    expect(avatarPair('siswa-123')).toBe(avatarPair('siswa-123'));
    for (const s of ['a', 'b', 'Gilang Ramadhan', '0b5f0a9e-7c1a-4f9e-9d2d-1a2b3c4d5e6f', '']) {
      expect(avatarPair(s)).toBeGreaterThanOrEqual(0);
      expect(avatarPair(s)).toBeLessThan(5);
    }
  });

  it('spreads different seeds over all five pairs', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => avatarPair(`id-${i}`)));
    expect(seen.size).toBe(5);
  });

  it('picks the colour from the seed, not the name', () => {
    const { container } = render(<Avatar name="Gilang Ramadhan" seed="id-7" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.textContent).toBe('GR');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.dataset.pair).toBe(String(avatarPair('id-7')));
  });
});

describe('deltaOf', () => {
  it('higher is better: up is good, down is bad', () => {
    expect(deltaOf(95.8, 95, true)).toMatchObject({ direction: 'up', meaning: 'good' });
    expect(deltaOf(94, 95, true)).toMatchObject({ direction: 'down', meaning: 'bad' });
  });

  it('fewer late students is good: down stays green', () => {
    expect(deltaOf(14, 20, false)).toEqual({ direction: 'down', meaning: 'good', amount: 6 });
    expect(deltaOf(9, 5, false)).toEqual({ direction: 'up', meaning: 'bad', amount: 4 });
  });

  it('equal is flat and neutral', () => {
    expect(deltaOf(3, 3)).toEqual({ direction: 'flat', meaning: 'neutral', amount: 0 });
  });
});

describe('DeltaPill', () => {
  it('speaks the whole sentence and hides the bare number', async () => {
    const { container } = render(<DeltaPill direction="down" meaning="good" text="6" label="turun 6 siswa dibanding kemarin" />);
    expect(screen.getByText('turun 6 siswa dibanding kemarin')).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('StatusChip and Chip', () => {
  it('always writes the word; Belum diisi is dashed', async () => {
    const { container } = render(
      <div>
        <StatusChip code="H" />
        <StatusChip code="T" label="Telat 14 m" />
        <StatusChip code="?" />
        <Chip tone="papan" square>
          X-2
        </Chip>
      </div>,
    );
    expect(screen.getByText('Hadir')).toBeTruthy();
    expect(screen.getByText('Telat 14 m')).toBeTruthy();
    expect(screen.getByText('Belum diisi').className).toContain('border-dashed');
    expect(screen.getByText('X-2')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('StackBar', () => {
  const parts = [
    { value: 9, label: 'Izin', tone: 'izin' as const },
    { value: 7, label: 'Sakit', tone: 'sakit' as const },
    { value: 8, label: 'Alpa', tone: 'alpa' as const },
  ];

  it('is an image named with every part', async () => {
    const { container } = render(<StackBar label="Tidak hadir" parts={parts} />);
    expect(screen.getByRole('img', { name: 'Tidak hadir: Izin 9, Sakit 7, Alpa 8' })).toBeTruthy();
    expect(stackLabel('x', [{ value: 1200, label: 'Hadir', tone: 'hadir' }])).toBe('x: Hadir 1.200');
    await expectNoAxeViolations(container);
  });

  it('leaves out empty parts from the drawing', () => {
    const { container } = render(<StackBar label="x" parts={[...parts, { value: 0, label: 'Telat', tone: 'telat' }]} />);
    expect(container.querySelectorAll('[role=img] > span')).toHaveLength(3);
  });
});

describe('ProgressBar v3', () => {
  it('says the target and can hide its words', () => {
    render(<ProgressBar bare label="Kehadiran" value={95.8} max={100} text="95,8%" target={95} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('95,8%, target 95');
    expect(screen.queryByText('95,8%')).toBeNull();
  });
});
