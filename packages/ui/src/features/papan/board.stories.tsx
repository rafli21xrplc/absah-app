import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../components/button';
import { PageMain } from '../../components/frames';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../../components/table';
import { AlertRow, BarList, BoardSection, StatusBoard, type BarItem, type StatusBoxData } from './board';

const meta = { title: 'Papan/Hari ini admin', component: BoardSection, parameters: { layout: 'fullscreen', ownsMain: true }, args: { title: 'Bagian', state: 'ready' } } satisfies Meta<typeof BoardSection>;
export default meta;
type Story = StoryObj<typeof meta>;

const BOXES: StatusBoxData[] = [
  { code: 'H', count: 862, caption: '97,3% hadir dan telat, dari 900 siswa' },
  { code: 'T', count: 14 },
  { code: 'I', count: 9, caption: '4 menunggu persetujuan' },
  { code: 'S', count: 7 },
  { code: 'A', count: 8 },
];

const ROWS = [
  ['Jam ke-2', '07.45–08.30', 'X-7', 'Sejarah', 'Bu Ratna W.', '1 jam 12 menit'],
  ['Jam ke-2', '07.45–08.30', 'Biologi XI · kelompok 2', 'Biologi', 'Pak Agus S.', '1 jam 12 menit'],
  ['Jam ke-3', '08.30–09.15', 'X-2', 'Matematika', 'Bu Sari D.', '27 menit'],
  ['Jam ke-3', '08.30–09.15', 'XII-9', 'Kimia', 'Pak Joko P.', '27 menit'],
];

const CLASSES: BarItem[] = ['X-1', 'X-2', 'X-3', 'X-4', 'X-5', 'X-6', 'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XI-6', 'XII-1', 'XII-2'].map((name, i) => {
  const alpa = name === 'XI-6' ? 2 : name === 'X-4' || name === 'XII-2' ? 1 : 0;
  const value = 1 - ((i * 7) % 5) / 25;
  const text = `${Math.round(value * 100)}%`;
  return { key: name, label: name, value, text, ...(alpa ? { flag: `A ${alpa}` } : {}), name: `${name}: ${text} hadir${alpa ? `, ${alpa} alpa` : ''}` };
});

const sessionsTable = (
  <Table caption="Daftar sesi belum diisi" className="min-w-160">
    <TableHead>
      <TableRow>
        {['Jam', 'Rombel / kelompok', 'Mapel', 'Guru', 'Lewat', 'Tindakan'].map((h) => (
          <Th key={h}>{h}</Th>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {ROWS.map(([jam, waktu, rombel, mapel, guru, lewat]) => (
        <TableRow key={`${rombel}${mapel}`}>
          <Td>
            <span className="flex flex-col">
              <span className="text-body-strong">{jam}</span>
              <span className="whitespace-nowrap text-small text-tinta-muted">{waktu}</span>
            </span>
          </Td>
          <Td>{rombel}</Td>
          <Td>{mapel}</Td>
          <Td>{guru}</Td>
          <Td className="whitespace-nowrap">{lewat}</Td>
          <Td>
            <a href="#sesi" className="text-body-strong text-papan">
              Buka
            </a>
          </Td>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

/** The whole board with data, as /dasbor draws it on a laptop (compare with design/boards/Main.dc.html). */
export const Lengkap: Story = {
  render: () => (
    <PageMain width="xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-h1">Hari ini</h1>
          <p className="m-0 text-body text-tinta-muted">Senin, 25 Januari 2027 · semester genap 2026/2027 · diperbarui 09.42</p>
        </div>
        <nav aria-label="Pintasan" className="flex gap-2">
          <Button variant="secondary" size="48">Papan kedatangan</Button>
          <Button variant="secondary" size="48">Rekap dan ekspor</Button>
        </nav>
      </header>
      <StatusBoard items={BOXES} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <BoardSection title="Sesi belum diisi" aside="4 sesi · 27 dari 35 sesi sudah diisi · 4 terlewat" state="ready">
          {sessionsTable}
          <p className="m-0 text-small text-tinta-muted">Sesi yang belum diisi masih bisa diisi sampai pukul 23.59, lalu dikunci otomatis.</p>
        </BoardSection>
        <BoardSection title="Makan Bergizi Gratis" aside="Jam batas 08.30" state="ready" action={<a href="#mbg" className="text-body-strong text-papan">Lihat porsi per rombel</a>}>
          <dl className="m-0 flex flex-col gap-3">
            <div className="flex flex-col">
              <dt className="text-small text-tinta-muted">Porsi hari ini</dt>
              <dd className="m-0 text-h1 tabular-nums">876</dd>
              <dd className="m-0 text-small text-tinta-muted">876 dari 900 penerima hadir</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-small text-tinta-muted">Prakiraan Kamis, 28 Januari</dt>
              <dd className="m-0 text-h2 tabular-nums">889</dd>
            </div>
          </dl>
        </BoardSection>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BoardSection title="Perlu perhatian" aside="Peringatan dini dari pola kehadiran" state="ready">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <AlertRow code="A" title="Fajar Nugroho · XI-6" detail="Alpa berturut-turut · terakhir 25 Jan" actions={<a href="#w" className="text-body-strong text-papan">Lihat detail</a>} />
            <AlertRow code="T" title="Bima Saputra · XII-2" detail="Terlambat berulang · terakhir 25 Jan" actions={<a href="#w" className="text-body-strong text-papan">Lihat detail</a>} />
          </ul>
        </BoardSection>
        <BoardSection title="Izin menunggu persetujuan" aside="Diajukan orang tua lewat WhatsApp atau portal" state="ready">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <AlertRow code="S" title="Nadia Putri · XI-2" detail="Sakit · 25 Jan – 26 Jan · surat dokter" actions={<><Button variant="secondary">Tolak</Button><Button>Setujui</Button></>} />
            <AlertRow code="I" title="Raka Pratama · X-9" detail="Izin · 26 Jan · acara keluarga" actions={<><Button variant="secondary">Tolak</Button><Button>Setujui</Button></>} />
          </ul>
        </BoardSection>
      </div>
      <BoardSection title="Kehadiran per rombel" aside="Hadir dan telat dari seluruh siswa rombel · huruf A menandai alpa" state="ready">
        <BarList label="Kehadiran per rombel" items={CLASSES} />
      </BoardSection>
    </PageMain>
  ),
};

/** The four states of one part, side by side: each part of the board has them on its own. */
export const EmpatKeadaan: Story = {
  render: () => (
    <PageMain width="lg">
      <h1 className="sr-only">Empat keadaan</h1>
      <BoardSection title="Memuat" state="loading" />
      <BoardSection title="Kosong" state="empty" emptyText="Semua sesi yang sudah lewat sudah diisi." />
      <BoardSection title="Galat" state="error" onRetry={() => undefined} />
      <BoardSection title="Tanpa sinyal" state="offline" onRetry={() => undefined} />
    </PageMain>
  ),
};
