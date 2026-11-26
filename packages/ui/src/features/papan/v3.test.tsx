// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { CheckCircle2, CircleCheck, MessageCircle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../../components/table';
import { ActivityFeed, Histogram, HeroRingCard, StatGroupCard, SummaryCard, TrendBarChart, percentText, trendSummary } from './v3';
import { ARRIVALS, TREND } from './v3.fixtures';

describe('percentText', () => {
  it('uses the id-ID comma and at most one decimal', () => {
    expect(percentText(0.958)).toBe('95,8%');
    expect(percentText(0.95)).toBe('95%');
    expect(percentText(0.9, 0)).toBe('90%');
  });
});

describe('trendSummary', () => {
  it('finds highest, lowest and mean, skipping days without a value', () => {
    const s = trendSummary([...TREND, { label: '26', title: '26 Jan', value: null }]);
    expect(s?.high.title).toBe('12 Jan');
    expect(s?.low.title).toBe('8 Jan');
    expect(s?.mean).toBeCloseTo(0.9541, 3);
  });

  it('is null without any value', () => {
    expect(trendSummary([{ label: '1', title: '1', value: null }])).toBeNull();
  });
});

describe('TrendBarChart', () => {
  it('has a title per bar, a labelled axis and a text summary', async () => {
    const { container } = render(<TrendBarChart data={TREND} target={0.95} caption="Januari 2027" />);
    expect(container.querySelectorAll('rect > title')).toHaveLength(TREND.length);
    expect(screen.getByText('90%')).toBeTruthy();
    expect(screen.getByText('Tertinggi', { exact: false })).toBeTruthy();
    expect(screen.getByText('Garis putus-putus = target 95%')).toBeTruthy();
    // Non-today bars use the chart token, today the brand green.
    expect(container.querySelectorAll('rect.fill-grafik-batang')).toHaveLength(TREND.length - 1);
    await expectNoAxeViolations(container);
  });
});

describe('HeroRingCard', () => {
  it('names the ring with the value', async () => {
    const { container } = render(<HeroRingCard title="Kehadiran hari ini" badge="900 siswa aktif" rate={0.958} value="862" lines={['hadir tepat waktu dari 900 siswa']} spark={TREND.map((d) => d.value ?? 0)} />);
    expect(screen.getByRole('img', { name: 'Kehadiran hari ini 95,8%' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('StatGroupCard', () => {
  it('lists three tiles as terms and values', async () => {
    const { container } = render(
      <StatGroupCard
        title="Masuk sekolah"
        icon={CheckCircle2}
        aside="dibanding kemarin"
        stats={[
          { label: 'Hadir', value: 862, dot: 'hadir', delta: { direction: 'up', meaning: 'good', text: '12', label: 'naik 12 siswa' } },
          { label: 'Telat', value: 14, dot: 'telat' },
          { label: 'Pulang awal', value: 3, dot: 'muted' },
        ]}
        footer="876 siswa di sekolah"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Masuk sekolah' })).toBeTruthy();
    expect(screen.getByText('862')).toBeTruthy();
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    await expectNoAxeViolations(container);
  });
});

describe('Histogram and ActivityFeed', () => {
  it('labels late bins in words', () => {
    render(<Histogram bins={ARRIVALS} label="Jam datang" caption="bel masuk 07.00" />);
    expect(screen.getByText('9 siswa, telat')).toBeTruthy();
  });

  it('shows at most five events, newest first, each with a <time>', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ key: String(i), at: `2027-01-25T0${i + 1}:00:00+07:00`, timeLabel: `0${i + 1}.00`, icon: MessageCircle, title: `Kejadian ${i}` }));
    const { container } = render(<ActivityFeed items={items} moreHref="/x" />);
    expect(container.querySelectorAll('time')).toHaveLength(5);
    expect(container.querySelector('li')?.textContent).toContain('Kejadian 6');
  });
});

describe('SummaryCard', () => {
  it('names the card and keeps the number with its unit and context', () => {
    render(<SummaryCard title="Sudah diisi" icon={CircleCheck} value="130" unit="dari 308 sesi" note="42,2% sesi hari ini sudah diisi" />);
    expect(screen.getByRole('heading', { name: 'Sudah diisi' })).toBeTruthy();
    expect(screen.getByText('130')).toBeTruthy();
    expect(screen.getByText('dari 308 sesi')).toBeTruthy();
    expect(screen.getByText('42,2% sesi hari ini sudah diisi')).toBeTruthy();
  });
});

describe('Table sticky', () => {
  it('scrolls in its own focusable region with a sticky head', () => {
    render(
      <Table sticky caption="Tabel sesi">
        <TableHead>
          <TableRow>
            <Th>Rombel</Th>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <Td>X-1</Td>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const region = screen.getByRole('region', { name: 'Tabel sesi' });
    expect(region.className).toContain('[&_thead_th]:sticky');
    expect(region.tabIndex).toBe(0);
  });
});
