// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('is a progressbar with a name, numbers and a spoken text', () => {
    render(<ProgressBar label="Presensi X-2" value={12} max={25} unit="siswa" />);
    const bar = screen.getByRole('progressbar', { name: 'Presensi X-2' });
    expect(bar.getAttribute('aria-valuenow')).toBe('12');
    expect(bar.getAttribute('aria-valuemax')).toBe('25');
    expect(bar.getAttribute('aria-valuetext')).toBe('12 dari 25 siswa');
    expect(screen.getByText('12 dari 25 siswa')).toBeTruthy();
  });

  it('the fill matches the share', () => {
    render(<ProgressBar label="x" value={5} max={20} />);
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe('25%');
  });

  it('never goes below 0 or above max, and a max of 0 does not divide by zero', () => {
    const { rerender } = render(<ProgressBar label="x" value={99} max={10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('10');
    rerender(<ProgressBar label="x" value={-3} max={10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<ProgressBar label="x" value={0} max={0} />);
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe('0%');
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProgressBar label="Presensi X-2" value={12} max={25} unit="siswa" />);
    await expectNoAxeViolations(container);
  });
});
