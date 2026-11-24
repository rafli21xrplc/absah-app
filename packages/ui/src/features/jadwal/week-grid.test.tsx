// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { WeekGrid, type WeekGridRow } from './week-grid';

const DAYS = ['Senin', 'Selasa', 'Jumat'];
const ROWS: WeekGridRow[] = [
  {
    number: 1,
    cells: [
      { time: '07.00–07.45', subject: 'Matematika', teacher: 'Bu Sari D.', label: 'Senin jam 1: Matematika' },
      { time: '07.00–07.45', label: 'Selasa jam 1: kosong' },
      { time: '07.00–07.45', label: 'Jumat jam 1: kosong' },
    ],
  },
  { number: 8, cells: [{ time: '13.15–14.00', label: 'Senin jam 8: kosong', selected: true }, { time: '13.15–14.00', label: 'Selasa jam 8: kosong' }, null] },
];

describe('WeekGrid', () => {
  it('is a table named for the week; every cell is a button that says what is in it', async () => {
    const { container } = render(<WeekGrid label="Jadwal mingguan" days={DAYS} rows={ROWS} onPick={() => undefined} />);
    expect(screen.getByRole('table', { name: 'Jadwal mingguan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Senin jam 1: Matematika' }).textContent).toContain('Bu Sari D.');
    // An empty slot says "kosong" in its name, not only in a dashed border.
    expect(screen.getByRole('button', { name: 'Selasa jam 1: kosong' }).textContent).toContain('—');
    // Friday has no jam 8: no button, not a dead one.
    expect(screen.getAllByRole('button')).toHaveLength(5);
    await expectNoAxeViolations(container);
  });

  it('marks the chosen cell and reports day and jam on a tap', async () => {
    const onPick = vi.fn();
    render(<WeekGrid label="Jadwal mingguan" days={DAYS} rows={ROWS} onPick={onPick} />);
    expect(screen.getByRole('button', { name: 'Senin jam 8: kosong' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Selasa jam 8: kosong' }));
    expect(onPick).toHaveBeenCalledWith(1, 8);
  });

  it('lets read-only roles see the lessons but not open them', () => {
    render(<WeekGrid label="Jadwal mingguan" days={DAYS} rows={ROWS} disabled onPick={() => undefined} />);
    expect(screen.getAllByRole<HTMLButtonElement>('button').every((b) => b.disabled)).toBe(true);
  });
});
