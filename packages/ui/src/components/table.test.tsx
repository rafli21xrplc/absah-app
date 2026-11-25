// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Button } from './button';
import { DataToolbar } from './data-toolbar';
import { Select } from './select';
import { Table, TableBody, TableHead, TableRow, Td, Th } from './table';

function StudentTable() {
  return (
    <main>
      <Table caption="Daftar siswa">
        <TableHead>
          <tr>
            <Th>Nama</Th>
            <Th>Rombel</Th>
            <Th>Status</Th>
          </tr>
        </TableHead>
        <TableBody>
          <TableRow>
            <Th scope="row">Gilang Ramadhan</Th>
            <Td>X-2</Td>
            <Td>Aktif</Td>
          </TableRow>
          <TableRow>
            <Th scope="row">Bayu Firmansyah</Th>
            <Td>X-2</Td>
            <Td>Aktif</Td>
          </TableRow>
        </TableBody>
      </Table>
    </main>
  );
}

describe('Table', () => {
  it('is a real table with a caption, column headers and row headers', async () => {
    const { container } = render(<StudentTable />);
    const table = screen.getByRole('table', { name: 'Daftar siswa' });
    expect(table.tagName).toBe('TABLE');
    expect(table.querySelector('caption')?.textContent).toBe('Daftar siswa');
    expect(screen.getAllByRole('columnheader').map((h) => h.getAttribute('scope'))).toEqual(['col', 'col', 'col']);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Gilang Ramadhan', 'Bayu Firmansyah']);
    expect(screen.getAllByRole('rowheader').every((h) => h.getAttribute('scope') === 'row')).toBe(true);
    await expectNoAxeViolations(container);
  });

  it('each cell is reached through its headers (row and column)', () => {
    render(<StudentTable />);
    const row = screen.getByRole('row', { name: /Gilang Ramadhan/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['X-2', 'Aktif']);
  });

  it('the scrolling wrapper is a named region the keyboard can reach', () => {
    render(<StudentTable />);
    const region = screen.getByRole('region', { name: 'Daftar siswa' });
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});

describe('DataToolbar', () => {
  function Demo({ onChange = () => undefined }: { onChange?: (v: string) => void }) {
    const [q, setQ] = useState('');
    return (
      <main>
        <DataToolbar
          search={{ label: 'Cari siswa', value: q, onChange: (v) => { setQ(v); onChange(v); }, placeholder: 'Cari nama atau NISN' }}
          actions={<Button>Tambah siswa</Button>}
        >
          <Select aria-label="Rombel" defaultValue="semua">
            <option value="semua">Semua rombel</option>
            <option value="x2">X-2</option>
          </Select>
        </DataToolbar>
      </main>
    );
  }

  it('the search box is named by its visible label and reports what is typed', async () => {
    const onChange = vi.fn();
    const { container } = render(<Demo onChange={onChange} />);
    const box = screen.getByRole('searchbox', { name: /Cari siswa/ });
    await userEvent.type(box, 'ayu');
    expect(onChange).toHaveBeenLastCalledWith('ayu');
    expect((box as HTMLInputElement).value).toBe('ayu');
    await expectNoAxeViolations(container);
  });

  it('holds the filters and the page action', () => {
    render(<Demo />);
    expect(screen.getByRole('combobox', { name: 'Rombel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tambah siswa' })).toBeTruthy();
  });
});
