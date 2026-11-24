import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, Trash2, X } from 'lucide-react';
import { IconButton } from './icon-button';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/IconButton', component: IconButton, args: { label: 'Tutup', icon: null } } satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { label: 'Tutup', icon: <X aria-hidden size={20} /> } };

export const StateMatrix: Story = {
  render: () => (
    <Matrix>
      <Cell title="bawaan"><IconButton label="Notifikasi" icon={<Bell aria-hidden size={20} />} /></Cell>
      <Cell title="sorot"><IconButton label="Notifikasi" className="pseudo-hover-all" icon={<Bell aria-hidden size={20} />} /></Cell>
      <Cell title="fokus"><IconButton label="Notifikasi" className="pseudo-focus-visible-all" icon={<Bell aria-hidden size={20} />} /></Cell>
      <Cell title="nonaktif"><IconButton label="Hapus" disabled icon={<Trash2 aria-hidden size={20} />} /></Cell>
    </Matrix>
  ),
  parameters: { pseudo: { hover: ['.pseudo-hover-all'], focusVisible: ['.pseudo-focus-visible-all'] } },
};
