import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';
import { Field, Select } from './field';

const meta = { title: 'Primitif/Dialog', component: Dialog, args: { open: true, onOpenChange: () => undefined, title: 'Judul' } } satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Try it: Esc, the scrim and Batal close it, and focus returns to this button. */
export const Playground: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>Keluarkan Gilang</Button>
        <Dialog open={open} onOpenChange={setOpen} alert title="Keluarkan Gilang Ramadhan dari siswa aktif?" description="Data tidak dihapus. Riwayat presensi dan rekapnya tetap tersimpan." actions={<Button variant="danger" onClick={() => setOpen(false)}>Keluarkan</Button>}>
          <Field label="Alasan">
            <Select defaultValue="pindah"><option value="pindah">Pindah sekolah</option><option value="keluar">Keluar</option></Select>
          </Field>
        </Dialog>
      </>
    );
  },
};

/** Opened from the start so the visual check and axe see it. The confirm question, as in the Data-siswa board. */
export const Konfirmasi: Story = {
  args: {
    alert: true,
    title: 'Keluarkan Gilang Ramadhan dari siswa aktif?',
    description: 'Data tidak dihapus. Riwayat presensi dan rekapnya tetap tersimpan.',
    actions: <Button variant="danger">Keluarkan</Button>,
    children: <Field label="Alasan"><Select defaultValue="pindah"><option value="pindah">Pindah sekolah</option><option value="keluar">Keluar</option></Select></Field>,
  },
};

export const Sederhana: Story = { args: { title: 'Simpan perubahan?', description: 'Perubahan jadwal berlaku mulai besok.', actions: <Button>Simpan</Button> } };
