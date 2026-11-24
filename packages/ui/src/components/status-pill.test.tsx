// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { STATUS_CODES } from '../status';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  it.each([
    ['H', 'Hadir'],
    ['T', 'Telat'],
    ['I', 'Izin'],
    ['S', 'Sakit'],
    ['A', 'Alpa'],
    ['?', 'Belum diisi'],
  ] as const)('%s shows the letter and the word %s', (code, word) => {
    const { container } = render(<StatusPill code={code} />);
    expect(container.textContent).toBe(`${code}${word}`);
  });

  it('? has a dashed border so it differs from the rest without colour', () => {
    render(<StatusPill code="?" />);
    expect(screen.getByText('Belum diisi').closest('span')?.className).toContain('border-dashed');
  });

  it('without onPress it is plain text, not a button', () => {
    render(<StatusPill code="H" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('with onPress it is a button with a chevron and a full name, at least 44 px high', async () => {
    const onPress = vi.fn();
    render(<StatusPill code="H" onPress={onPress} ariaLabel="Gilang Ramadhan: Hadir. Ketuk untuk mengubah." />);
    const b = screen.getByRole('button', { name: 'Gilang Ramadhan: Hadir. Ketuk untuk mengubah.' });
    expect(b.className).toContain('min-h-11');
    expect(b.querySelector('svg')).not.toBeNull();
    await userEvent.click(b);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('every code in the fixed order renders, with no axe violations', async () => {
    const { container } = render(
      <div>
        {STATUS_CODES.map((c) => (
          <StatusPill key={c} code={c} />
        ))}
        <StatusPill code="A" onPress={() => undefined} ariaLabel="Rina: Alpa. Ketuk untuk mengubah." />
      </div>,
    );
    expect(container.textContent).toContain('HHadirTTelatIIzinSSakitAAlpa?Belum diisi');
    await expectNoAxeViolations(container);
  });
});
