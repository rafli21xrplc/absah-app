import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './button';
import { Drawer } from './drawer';
import { Field, Input, Select } from './field';

const meta = { title: 'Primitif/Drawer', component: Drawer, args: { open: true, onOpenChange: () => undefined, title: 'Judul', children: null } } satisfies Meta<typeof Drawer> ;
export default meta;
type Story = StoryObj<typeof meta>;

function StudentForm() {
  return (
    <>
      <Field label="Nama lengkap"><Input name="nama" /></Field>
      <Field label="NISN" hint="Sepuluh angka, seperti di Dapodik"><Input name="nisn" inputMode="numeric" /></Field>
      <Field label="Rombel"><Select name="rombel" defaultValue="x2"><option value="x2">X-2</option><option value="x3">X-3</option></Select></Field>
      <Field label="Catatan" optional><Input name="catatan" /></Field>
    </>
  );
}

export const Playground: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Tambah siswa</Button>
        <Drawer open={open} onOpenChange={setOpen} title="Tambah siswa" onSubmit={(e) => { e.preventDefault(); setOpen(false); }} actions={<Button type="submit">Simpan</Button>}>
          <StudentForm />
        </Drawer>
      </>
    );
  },
};

export const FormSiswa: Story = { args: { title: 'Tambah siswa', actions: <Button type="submit">Simpan</Button>, onSubmit: (e) => e.preventDefault(), children: <StudentForm /> } };
