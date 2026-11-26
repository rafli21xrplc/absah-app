// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CircleCheck } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Badge, DataCard, Pagination, PersonCell, StackedBars, StatCard, pageList } from './dashboard-parts';

describe('dashboard parts', () => {
  it('pageList keeps first, last and neighbours', () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(1, 3)).toEqual([1, 2, 3]);
    expect(pageList(5, 11)).toEqual([1, null, 4, 5, 6, null, 11]);
    expect(pageList(11, 11)).toEqual([1, null, 10, 11]);
  });

  it('pagination says the range and moves pages', async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pageCount={3} total={24} size={10} onPage={onPage} />);
    expect(screen.getByText('11–20 dari 24')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Halaman 2' }).getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it('stat card, bars, badge and table card pass axe', async () => {
    const { container } = render(
      <main>
        <StatCard title="Hadir" tone="hadir" icon={CircleCheck} value={93} unit="siswa" delta={{ text: '+4', label: 'dibanding kemarin' }} parts={[{ value: 82, label: 'Tepat waktu' }, { value: 11, label: 'Telat' }]} />
        <StackedBars title="Tren" legend={[{ label: 'Hadir', fill: 'bg-papan' }, { label: 'Tidak hadir', fill: 'bg-garis' }]} bars={[{ key: 'a', label: '1 Nov', segments: [{ value: 9, fill: 'bg-papan', label: 'Hadir' }, { value: 1, fill: 'bg-garis', label: 'Tidak hadir' }] }]} />
        <DataCard title="Izin siswa" aside="2 izin">
          <PersonCell name="Rizky Pratama" detail="VII A" />
          <Badge tone="telat">Menunggu</Badge>
        </DataCard>
      </main>,
    );
    expect(screen.getByRole('region', { name: 'Hadir' }).textContent).toContain('82');
    expect(screen.getByRole('table', { name: 'Tren' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
