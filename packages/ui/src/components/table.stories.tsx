import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { Button } from './button';
import { DataToolbar } from './data-toolbar';
import { Select } from './select';
import { SegmentedControl } from './segmented-control';
import { StatusPill } from './status-pill';
import { Table, TableBody, TableHead, TableRow, Td, Th } from './table';

const meta = { title: 'Primitif/Table', component: Table, args: { caption: 'Daftar siswa', children: null } } satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;

const STUDENTS = [
  { nama: 'Adinda Saraswati', nisn: '0081234501', rombel: 'X-2', status: 'aktif', hari: 'H' },
  { nama: 'Ahmad Fauzan', nisn: '0081234502', rombel: 'X-2', status: 'aktif', hari: 'T' },
  { nama: 'Bayu Firmansyah', nisn: '0081234505', rombel: 'X-3', status: 'aktif', hari: 'H' },
  { nama: 'Gilang Ramadhan', nisn: '0081234510', rombel: 'X-3', status: 'keluar', hari: 'A' },
  { nama: 'Putri Ayu Lestari', nisn: '0081234520', rombel: 'X-2', status: 'aktif', hari: 'S' },
] as const;

/** The data-page pattern of U6: toolbar (search, filters, action) above a real table. */
export const HalamanData: Story = {
  render: () => {
    const [q, setQ] = useState('');
    const [rombel, setRombel] = useState('semua');
    const [status, setStatus] = useState<'aktif' | 'keluar' | 'semua'>('aktif');
    const rows = useMemo(
      () => STUDENTS.filter((s) => (status === 'semua' || s.status === status) && (rombel === 'semua' || s.rombel === rombel) && `${s.nama} ${s.nisn}`.toLowerCase().includes(q.toLowerCase())),
      [q, rombel, status],
    );
    return (
      <div className="flex flex-col gap-4">
        <DataToolbar search={{ label: 'Cari siswa', value: q, onChange: setQ, placeholder: 'Cari nama atau NISN' }} actions={<Button>Tambah siswa</Button>}>
          <Select aria-label="Rombel" value={rombel} onChange={(e) => setRombel(e.target.value)} className="w-auto">
            <option value="semua">Semua rombel</option><option value="X-2">X-2</option><option value="X-3">X-3</option>
          </Select>
          <SegmentedControl label="Status" value={status} onChange={setStatus} options={[{ value: 'aktif', label: 'Aktif' }, { value: 'keluar', label: 'Keluar' }, { value: 'semua', label: 'Semua' }]} />
        </DataToolbar>
        <Table caption="Daftar siswa" className="min-w-160">
          <TableHead>
            <tr><Th>Nama</Th><Th>NISN</Th><Th>Rombel</Th><Th>Hari ini</Th></tr>
          </TableHead>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.nisn}>
                <Th scope="row">{s.nama}</Th>
                <Td>{s.nisn}</Td>
                <Td>{s.rombel}</Td>
                <Td><StatusPill code={s.hari} /></Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  },
};
