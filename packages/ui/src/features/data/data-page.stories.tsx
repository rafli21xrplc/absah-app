import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { DataToolbar } from '../../components/data-toolbar';
import { Field, Select } from '../../components/field';
import { PageMain } from '../../components/frames';
import { SegmentedControl } from '../../components/segmented-control';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../../components/table';
import { DataHeader } from './data-page';
import { ExitDialog } from './exit-dialog';

const meta = { title: 'Data/Siswa', component: DataHeader, parameters: { layout: 'fullscreen', ownsMain: true }, args: { title: 'Siswa' } } satisfies Meta<typeof DataHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

const ROWS: [string, string, string, string, 'Aktif' | 'Calon keluar'][] = [
  ['Gilang Ramadhan', '0081234501', 'X-2', 'L', 'Aktif'],
  ['Putri Ayu Lestari', '0081234502', 'X-2', 'P', 'Aktif'],
  ['Bayu Firmansyah', '0081234503', 'X-2', 'L', 'Aktif'],
  ['Nadia Putri', '0071234511', 'XI-2', 'P', 'Aktif'],
  ['Fajar Nugroho', '0071234512', 'XI-6', 'L', 'Calon keluar'],
  ['Salsa Amelia', '0081234520', 'X-3', 'P', 'Aktif'],
];

function Page({ missing = false }: { missing?: boolean }) {
  const rows = missing ? ROWS.filter((r) => r[4] === 'Calon keluar') : ROWS;
  return (
    <PageMain width="xl">
      <DataHeader title="Siswa" subtitle="36 rombel" actions={<Button variant="secondary" size="48">Import dari Dapodik</Button>} />
      <DataToolbar search={{ label: 'Cari siswa', value: '', onChange: () => undefined, placeholder: 'Nama, NISN, atau NIPD' }}>
        <Field label="Rombel" className="min-w-44">
          <Select defaultValue="">
            <option value="">Semua rombel</option>
            <option>X-2</option>
          </Select>
        </Field>
        <SegmentedControl label="Status" value={missing ? 'missing' : 'active'} onChange={() => undefined} options={[{ value: 'active', label: 'Aktif' }, { value: 'missing', label: 'Calon keluar' }, { value: 'all', label: 'Semua' }]} />
      </DataToolbar>
      {missing && <Banner kind="info">Siswa ini tidak ada di import Dapodik terakhir. Pastikan statusnya: tetap bersekolah, pindah, atau keluar.</Banner>}
      <Table caption="Daftar siswa" className="min-w-160">
        <TableHead>
          <TableRow>
            {['Nama', 'Rombel', 'L/P', 'Status', 'Tindakan'].map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(([name, nisn, rombel, jk, status]) => (
            <TableRow key={name}>
              <Th scope="row" className="font-normal">
                <span className="flex flex-col">
                  <span className="text-body-strong text-tinta">{name}</span>
                  <span className="text-small text-tinta-muted">NISN {nisn}</span>
                </span>
              </Th>
              <Td>{rombel}</Td>
              <Td>{jk}</Td>
              <Td>
                <span className={status === 'Aktif' ? 'text-body-strong text-hadir' : 'text-body-strong text-telat'}>{status}</span>
              </Td>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <a href="#kontak" aria-label={`Kontak WhatsApp ${name}`} className="text-body-strong text-papan">Kontak</a>
                  {status === 'Calon keluar' && <Button variant="secondary" aria-label={`Masih bersekolah: ${name}`}>Masih bersekolah</Button>}
                  <Button variant="secondary" aria-label={`Keluarkan ${name}`}>Keluarkan</Button>
                </span>
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="m-0 text-small text-tinta-muted">Menampilkan {rows.length} siswa</p>
    </PageMain>
  );
}

/** The Data page pattern: header, toolbar, table. Siswa is the first page built on it. */
export const Daftar: Story = { render: () => <Page /> };
export const CalonKeluar: Story = { render: () => <Page missing /> };

/** Nothing is chosen beforehand; the button stays off until a reason is picked. */
export const KeluarkanSiswa: Story = {
  render: () => (
    <PageMain width="xl">
      <h1 className="sr-only">Keluarkan siswa</h1>
      <ExitDialog
        open
        onOpenChange={() => undefined}
        title="Keluarkan Fajar Nugroho dari siswa aktif?"
        description="Data tidak dihapus. Riwayat presensi dan rekapnya tetap tersimpan, dan siswa tidak lagi masuk daftar presensi."
        reasonLabel="Alasan"
        reasons={[{ value: 'moved', label: 'Pindah sekolah' }, { value: 'left', label: 'Keluar' }]}
        confirmLabel="Keluarkan"
        onConfirm={() => undefined}
      />
    </PageMain>
  ),
};
