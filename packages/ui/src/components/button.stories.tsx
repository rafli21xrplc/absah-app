import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Button, type ButtonVariant } from './button';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/Button', component: Button, parameters: { layout: 'padded' } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS: ButtonVariant[] = ['primary', 'stabilo', 'secondary', 'ghost', 'danger'];

export const Playground: Story = { args: { children: 'Kirim presensi', variant: 'primary', size: '44' } };

/** All five variants in the six states of the Sistem-UI board. Hover and focus are forced by pseudo-states. */
export const StateMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {VARIANTS.map((v) => (
        <section key={v} className="flex flex-col gap-3">
          <h2 className="text-h2">{v}</h2>
          <Matrix>
            <Cell title="bawaan"><Button variant={v}>Simpan</Button></Cell>
            <Cell title="sorot (hover)"><Button variant={v} className="pseudo-hover-all">Simpan</Button></Cell>
            <Cell title="fokus"><Button variant={v} className="pseudo-focus-visible-all">Simpan</Button></Cell>
            <Cell title="nonaktif, dengan alasan"><Button variant={v} disabled disabledReason="Pilih siswa dulu">Simpan</Button></Cell>
            <Cell title="memuat"><Button variant={v} loading>Simpan</Button></Cell>
            <Cell title="dengan ikon"><Button variant={v}><Plus aria-hidden size={18} /> Tambah</Button></Cell>
          </Matrix>
        </section>
      ))}
    </div>
  ),
  parameters: { pseudo: { hover: ['.pseudo-hover-all'], focusVisible: ['.pseudo-focus-visible-all'] } },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <Button size="44">Ukuran 44 (bawaan)</Button>
      <Button size="48">Ukuran 48</Button>
      <Button size="52">Ukuran 52 (aksi utama)</Button>
      <Button size="64" className="w-full">Ukuran 64 (baris siswa)</Button>
    </div>
  ),
};
