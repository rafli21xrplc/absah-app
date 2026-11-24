import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Card } from './card';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/Card', component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { children: 'Isi kartu' } };

/** The "Hari ini" lesson card from Alur-presensi: the one in progress has the thick green border. */
export const Tones: Story = {
  render: () => (
    <Matrix cols={3}>
      <Cell fill title="biasa"><Card><p className="m-0 text-body-strong">X-3 · Fisika</p><p className="m-0 text-small text-tinta-muted">Jam ke-4 · Ruang 14</p></Card></Cell>
      <Cell fill title="sedang berlangsung (active)"><Card tone="active" className="flex flex-col gap-3"><p className="m-0 text-body-strong">X-2 · Matematika</p><p className="m-0 text-small text-tinta-muted">Jam ke-3 · Ruang 12 · 25 siswa</p><Button size="52">Isi presensi</Button></Card></Cell>
      <Cell fill title="tenang (muted)"><Card tone="muted"><p className="m-0 text-body-strong">Sudah selesai</p></Card></Cell>
    </Matrix>
  ),
};
