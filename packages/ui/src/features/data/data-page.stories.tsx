import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { DataToolbar } from '../../components/data-toolbar';
import { Field, Select } from '../../components/field';
import { PageMain } from '../../components/frames';
import { SegmentedControl } from '../../components/segmented-control';
import { Drawer } from '../../components/drawer';
import { Input } from '../../components/field';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../../components/table';
import { WeekGrid } from '../jadwal/week-grid';
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

const CLASSES: [string, string, string, number, number][] = [
  ['X-1', '10 · IPA', 'Bu Ratna Wulandari', 36, 0],
  ['X-2', '10 · IPA', 'Pak Agus Setiawan', 35, 0],
  ['X-3', '10 · IPS', 'Bu Sari Dewi', 34, 1],
  ['XI-1', '11 · IPA', 'Pak Joko Pramono', 36, 0],
  ['XI-6', '11 · IPS', 'Belum ditentukan', 33, 2],
  ['XII-2', '12 · Bahasa', 'Bu Yuni Amelia', 30, 0],
];

/** Rombel: the same pattern as Siswa, with the Kelas filter and counts that line up to the right. */
export const Rombel: Story = {
  render: () => (
    <PageMain width="xl">
      <DataHeader title="Rombel 2026/2027" subtitle="36 rombel" actions={<Button variant="secondary" size="48">Import data siswa</Button>} />
      <DataToolbar search={{ label: 'Cari rombel', value: '', onChange: () => undefined, placeholder: 'Nama rombel' }}>
        <Field label="Kelas" className="min-w-44">
          <Select defaultValue="">
            <option value="">Semua kelas</option>
            <option>10</option>
          </Select>
        </Field>
      </DataToolbar>
      <Table caption="Daftar rombel" className="min-w-160">
        <TableHead>
          <TableRow>
            <Th>Rombel</Th>
            <Th>Kelas</Th>
            <Th>Wali kelas</Th>
            <Th className="text-right">Siswa</Th>
            <Th className="text-right">Calon keluar</Th>
          </TableRow>
        </TableHead>
        <TableBody>
          {CLASSES.map(([name, grade, homeroom, students, missing]) => (
            <TableRow key={name}>
              <Th scope="row">
                <a href="#siswa" className="text-papan">{name}</a>
              </Th>
              <Td>{grade}</Td>
              <Td className={homeroom.startsWith('Belum') ? 'text-tinta-muted' : undefined}>{homeroom}</Td>
              <Td className="text-right tabular-nums">{students}</Td>
              <Td className="text-right tabular-nums">{missing > 0 ? <span className="text-body-strong text-telat">{missing}</span> : 0}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageMain>
  ),
};

/** Mapel: list and add only. The drawer opens over the list; a refused name is said in words under the field. */
export const MapelTambah: Story = {
  render: () => (
    <PageMain width="xl">
      <DataHeader title="Mata pelajaran" subtitle="4 mapel" />
      <DataToolbar search={{ label: 'Cari mapel', value: '', onChange: () => undefined, placeholder: 'Nama atau kode mapel' }} actions={<Button>Tambah mapel</Button>} />
      <Table caption="Daftar mata pelajaran" className="min-w-96">
        <TableHead>
          <TableRow>
            <Th>Nama mapel</Th>
            <Th>Kode</Th>
          </TableRow>
        </TableHead>
        <TableBody>
          {[['Matematika', 'MTK'], ['Bahasa Indonesia', 'BIN'], ['Fisika', 'FIS'], ['Sejarah', '–']].map(([n, c]) => (
            <TableRow key={n}>
              <Th scope="row">{n}</Th>
              <Td>{c}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Drawer open onOpenChange={() => undefined} title="Tambah mata pelajaran" onSubmit={(e) => e.preventDefault()} actions={<Button type="submit">Simpan</Button>}>
        <Field label="Nama mapel" error="Nama mapel minimal 2 huruf.">
          <Input defaultValue="M" />
        </Field>
        <Field label="Kode" optional hint="Singkatan untuk jadwal, misalnya MTK.">
          <Input />
        </Field>
      </Drawer>
    </PageMain>
  ),
};

const WEEK_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const PLAN: ([string, string] | null)[][] = [
  [['Pend. Pancasila', 'Pak Teguh'], ['B. Indonesia', 'Bu Lestari'], ['PJOK', 'Pak Dwi'], ['IPA', 'Pak Joko P.'], ['PAI', 'Pak Hasan']],
  [['Pend. Pancasila', 'Pak Teguh'], ['B. Indonesia', 'Bu Lestari'], ['PJOK', 'Pak Dwi'], ['IPA', 'Pak Joko P.'], ['PAI', 'Pak Hasan']],
  [['Matematika', 'Bu Sari D.'], ['B. Inggris', 'Bu Desi R.'], ['PJOK', 'Pak Dwi'], ['Matematika', 'Bu Sari D.'], ['B. Jawa', 'Bu Endang']],
  [['Matematika', 'Bu Sari D.'], ['B. Inggris', 'Bu Desi R.'], ['Sejarah', 'Bu Ratna W.'], ['Matematika', 'Bu Sari D.'], ['B. Jawa', 'Bu Endang']],
  [['IPA', 'Pak Joko P.'], ['Informatika', 'Pak Yoga'], ['Sejarah', 'Bu Ratna W.'], null, ['PAI', 'Pak Hasan']],
  [null, ['Informatika', 'Pak Yoga'], null, ['IPS', 'Bu Yuliana'], null],
];
const TIMES = ['07.00–07.45', '07.45–08.30', '08.30–09.15', '09.15–10.00', '10.15–11.00', '11.00–11.45'];

/** Jadwal: one rombel's week. The Drawer edits a lesson (see MapelTambah for the drawer look). */
export const JadwalMingguan: Story = {
  render: () => (
    <PageMain width="xl">
      <DataHeader title="Jadwal 2026/2027" />
      <Field label="Rombel" className="max-w-xs">
        <Select defaultValue="x2">
          <option value="x2">X-2</option>
        </Select>
      </Field>
      <WeekGrid
        label="Jadwal mingguan"
        days={WEEK_DAYS}
        onPick={() => undefined}
        rows={PLAN.map((row, r) => ({
          number: r + 1,
          cells: row.map((c, d) => ({
            time: TIMES[r] ?? '',
            subject: c?.[0],
            teacher: c?.[1],
            label: `${WEEK_DAYS[d]} jam ${r + 1}: ${c ? c[0] : 'kosong'}`,
            selected: r === 2 && d === 0,
          })),
        }))}
      />
    </PageMain>
  ),
};
