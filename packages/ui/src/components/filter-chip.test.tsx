// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { FilterChip } from './filter-chip';

describe('FilterChip', () => {
  it('is a word with a number, and says whether it is on', () => {
    render(
      <div>
        <FilterChip label="Semua" count={25} selected />
        <FilterChip label="Tidak hadir" count={3} />
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Semua 25' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Tidak hadir 3' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('a chip with zero items still shows the zero', () => {
    render(<FilterChip label="Belum" count={0} />);
    expect(screen.getByRole('button', { name: 'Belum 0' })).toBeTruthy();
  });

  it('calls onClick and is at least 44 px high', async () => {
    const onClick = vi.fn();
    render(<FilterChip label="Belum" count={2} onClick={onClick} />);
    const b = screen.getByRole('button');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledOnce();
    expect(b.className).toContain('min-h-11');
  });

  it('has no axe violations', async () => {
    const { container } = render(<FilterChip label="Semua" count={25} selected />);
    await expectNoAxeViolations(container);
  });
});
