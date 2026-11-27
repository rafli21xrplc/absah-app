import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DateInput, DateRangeInput } from './date-input';
import { Field } from './field';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/DateInput', component: DateInput, args: { type: 'date' } } satisfies Meta<typeof DateInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Laptop (>= 1024 px): a button that opens a popover. Phone: the browser's own picker. */
export const Playground: Story = {
  render: (args) => (
    <Field label="Tanggal kejadian">
      <DateInput {...args} defaultValue="2026-11-27" />
    </Field>
  ),
};

function Range() {
  const [r, setR] = useState({ from: '2026-11-24', to: '2026-11-27' });
  return (
    <Field label="Tanggal izin">
      <DateRangeInput from={r.from} to={r.to} onChange={(from, to) => setR({ from, to })} />
    </Field>
  );
}

/** Each kind closed, empty, with an error, and the range. Open one to see the calendar, month grid, or hour and minute lists. */
export const Kinds: Story = {
  render: () => (
    <Matrix cols={2}>
      <Cell fill title="Tanggal"><Field label="Tanggal"><DateInput type="date" defaultValue="2026-11-27" /></Field></Cell>
      <Cell fill title="Tanggal: kosong"><Field label="Jatuh tempo" optional><DateInput type="date" /></Field></Cell>
      <Cell fill title="Bulan"><Field label="Bulan"><DateInput type="month" defaultValue="2026-11" /></Field></Cell>
      <Cell fill title="Jam"><Field label="Jam batas"><DateInput type="time" defaultValue="09:15" /></Field></Cell>
      <Cell fill title="Tanggal: galat"><Field label="Tanggal mulai" error="Tanggal mulai wajib diisi"><DateInput type="date" /></Field></Cell>
      <Cell fill title="Rentang tanggal"><Range /></Cell>
    </Matrix>
  ),
};
