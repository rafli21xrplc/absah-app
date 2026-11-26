// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { DateSwitcher, PageHeader } from './page-header';

describe('PageHeader', () => {
  it('has one h1, the date and the freshness line', async () => {
    const { container } = render(<PageHeader title="Hari ini" date={{ label: 'Senin, 25 Januari 2027' }} updated="Diperbarui 09.42" actions={<button type="button">Unduh</button>} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Senin, 25 Januari 2027')).toBeTruthy();
    expect(screen.getByText('Diperbarui 09.42')).toBeTruthy();
    // Without handlers there are no arrows that do nothing.
    expect(screen.queryByRole('button', { name: 'Hari sebelumnya' })).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe('DateSwitcher', () => {
  it('names the arrows and can stop at today', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<DateSwitcher label="Senin, 25 Januari 2027" onPrev={onPrev} onNext={onNext} nextDisabled />);
    await userEvent.click(screen.getByRole('button', { name: 'Hari sebelumnya' }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Hari berikutnya' }).disabled).toBe(true);
  });
});
