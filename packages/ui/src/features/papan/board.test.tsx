// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { AlertRow, BarList, BoardSection, StatusBoard } from './board';

const FIVE = [
  { code: 'H', count: 862, caption: '97,3% hadir dan telat, dari 900 siswa' },
  { code: 'T', count: 14 },
  { code: 'I', count: 9, caption: '4 menunggu persetujuan' },
  { code: 'S', count: 7 },
  { code: 'A', count: 8 },
] as const;

describe('StatusBoard', () => {
  it('shows the five statuses in the fixed order, each as letter + word + number', async () => {
    const { container } = render(<StatusBoard items={FIVE} />);
    const list = screen.getByRole('list', { name: 'Ringkasan kehadiran siswa' });
    const boxes = within(list).getAllByRole('listitem');
    expect(boxes.map((b) => b.textContent?.replace(/\d.*$/, ''))).toEqual(['HHadir', 'TTelat', 'IIzin', 'SSakit', 'AAlpa']);
    expect(boxes[0]?.textContent).toContain('862');
    expect(boxes[0]?.textContent).toContain('97,3% hadir dan telat, dari 900 siswa');
    expect(boxes[3]?.textContent).toBe('SSakit7');
    await expectNoAxeViolations(container);
  });
});

describe('BoardSection: the four states', () => {
  const section = (state: Parameters<typeof BoardSection>[0]['state'], over: Partial<Parameters<typeof BoardSection>[0]> = {}) => (
    <BoardSection title="Sesi belum diisi" aside="6 sesi" action={<button type="button">Buka</button>} state={state} emptyText="Semua sesi sudah diisi." {...over}>
      <p>isi</p>
    </BoardSection>
  );

  it('ready: the title, the aside, the action and the content', async () => {
    const { container } = render(section('ready'));
    expect(screen.getByRole('heading', { level: 2, name: 'Sesi belum diisi' })).toBeTruthy();
    expect(screen.getByText('6 sesi')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buka' })).toBeTruthy();
    expect(screen.getByText('isi')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sesi belum diisi' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('loading: a skeleton, marked busy, no content and no action', () => {
    render(section('loading'));
    expect(screen.getByRole('region', { name: 'Sesi belum diisi', busy: true })).toBeTruthy();
    expect(screen.queryByText('isi')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Buka' })).toBeNull();
  });

  it('empty: says so in plain words', async () => {
    const { container } = render(section('empty'));
    expect(screen.getByText('Semua sesi sudah diisi.')).toBeTruthy();
    expect(screen.queryByText('isi')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('error: names the part, keeps the data safe and retries', async () => {
    const onRetry = vi.fn();
    const { container } = render(section('error', { onRetry }));
    expect(screen.getByText('Sesi belum diisi belum bisa dimuat')).toBeTruthy();
    expect(screen.getByText(/Data Anda aman/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledOnce();
    await expectNoAxeViolations(container);
  });

  it('offline: a yellow banner and a retry', async () => {
    const onRetry = vi.fn();
    const { container } = render(section('offline', { onRetry }));
    expect(screen.getByRole('status').textContent).toContain('Tanpa sinyal');
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledOnce();
    await expectNoAxeViolations(container);
  });

  it('one section failing does not touch the one beside it', () => {
    render(
      <>
        {section('error')}
        <BoardSection title="Izin menunggu persetujuan" state="ready">
          <p>ada izin</p>
        </BoardSection>
      </>,
    );
    expect(screen.getByText('ada izin')).toBeTruthy();
  });
});

describe('AlertRow', () => {
  it('names the status by word for a screen reader and offers the actions', async () => {
    const { container } = render(
      <ul>
        <AlertRow code="A" title="Fajar Nugroho · XI-6" detail="Alpa berturut-turut · terakhir 25 Jan" actions={<a href="/peringatan-dini">Lihat detail</a>} />
        <AlertRow code="S" title="Nadia Putri · XI-2" detail="Sakit · 25–26 Jan" actions={<button type="button">Setujui</button>} />
      </ul>,
    );
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('aria-label'))).toEqual(['Alpa', 'Sakit']);
    expect(screen.getByRole('link', { name: 'Lihat detail' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('BarList', () => {
  const items = [
    { key: 'a', label: 'X-1', value: 0.96, text: '96%', name: 'X-1: 96% hadir' },
    { key: 'b', label: 'X-2', value: 0.88, text: '88%', flag: 'A 2', name: 'X-2: 88% hadir, 2 alpa' },
    { key: 'c', label: 'X-3', value: null, text: '–', name: 'X-3: belum ada presensi' },
  ];

  it('an empty value is an empty bar, a flag is a word, and the bar says its number', async () => {
    const { container } = render(<BarList label="Kehadiran per rombel" items={items} />);
    const bars = screen.getAllByRole('img');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual(['X-1: 96% hadir', 'X-2: 88% hadir, 2 alpa', 'X-3: belum ada presensi']);
    expect((bars[0]?.firstElementChild as HTMLElement).style.width).toBe('96%');
    expect((bars[2]?.firstElementChild as HTMLElement).style.width).toBe('0%');
    expect(screen.getByText('A 2')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
