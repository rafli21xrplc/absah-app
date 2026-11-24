import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FilterChip } from './filter-chip';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/FilterChip', component: FilterChip, args: { label: 'Semua', count: 0 } } satisfies Meta<typeof FilterChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { label: 'Belum diisi', count: 4, selected: false } };

export const StateMatrix: Story = {
  render: () => (
    <Matrix>
      <Cell title="bawaan"><FilterChip label="Semua" count={25} /></Cell>
      <Cell title="terpilih"><FilterChip label="Semua" count={25} selected /></Cell>
      <Cell title="sorot"><FilterChip label="Telat" count={3} className="pseudo-hover-all" /></Cell>
      <Cell title="fokus"><FilterChip label="Telat" count={3} className="pseudo-focus-visible-all" /></Cell>
      <Cell title="nonaktif"><FilterChip label="Alpa" count={0} disabled /></Cell>
    </Matrix>
  ),
  parameters: { pseudo: { hover: ['.pseudo-hover-all'], focusVisible: ['.pseudo-focus-visible-all'] } },
};

export const Group: Story = {
  render: () => {
    const [on, setOn] = useState('Semua');
    const items: [string, number][] = [['Semua', 25], ['Belum diisi', 4], ['Telat', 3], ['Alpa', 1]];
    return (
      <div className="flex flex-wrap gap-2">
        {items.map(([label, count]) => <FilterChip key={label} label={label} count={count} selected={on === label} onClick={() => setOn(label)} />)}
      </div>
    );
  },
};
