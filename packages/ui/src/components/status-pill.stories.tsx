import type { Meta, StoryObj } from '@storybook/react-vite';
import { STATUS_CODES } from '../status';
import { StatusPill } from './status-pill';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/StatusPill', component: StatusPill, args: { code: 'H' } } satisfies Meta<typeof StatusPill>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { code: 'H' } };

/** Order is fixed everywhere: Hadir, Telat, Izin, Sakit, Alpa. Empty is "Belum diisi" with a dashed border. */
export const AllStatuses: Story = {
  render: () => (
    <Matrix>
      {STATUS_CODES.map((c) => <Cell key={c} title={c}><StatusPill code={c} /></Cell>)}
      <Cell title="kosong"><StatusPill code="?" /></Cell>
    </Matrix>
  ),
};

export const StateMatrix: Story = {
  render: () => (
    <Matrix>
      <Cell title="hanya tampilan"><StatusPill code="T" /></Cell>
      <Cell title="bisa diketuk"><StatusPill code="T" onPress={() => undefined} ariaLabel="Gilang Ramadhan: Telat. Ketuk untuk mengubah." /></Cell>
      <Cell title="sorot"><StatusPill code="T" onPress={() => undefined} ariaLabel="Gilang Ramadhan: Telat. Ketuk untuk mengubah." className="pseudo-hover-all" /></Cell>
      <Cell title="fokus"><StatusPill code="A" onPress={() => undefined} ariaLabel="Gilang Ramadhan: Alpa. Ketuk untuk mengubah." className="pseudo-focus-visible-all" /></Cell>
      <Cell title="belum diisi, bisa diketuk"><StatusPill code="?" onPress={() => undefined} ariaLabel="Gilang Ramadhan: Belum diisi. Ketuk untuk mengisi." /></Cell>
    </Matrix>
  ),
  parameters: { pseudo: { hover: ['.pseudo-hover-all'], focusVisible: ['.pseudo-focus-visible-all'] } },
};
