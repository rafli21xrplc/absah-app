import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './button';
import { Sheet } from './sheet';

const meta = { title: 'Primitif/Sheet', component: Sheet, args: { open: true, onOpenChange: () => undefined, title: 'Judul', children: null } } satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

const CHOICES: [string, string][] = [
  ['Hadir', 'Ada di kelas'],
  ['Telat', 'Datang setelah pelajaran dimulai'],
  ['Izin', 'Tidak hadir, ada surat atau kabar dari orang tua'],
  ['Sakit', 'Tidak hadir karena sakit'],
  ['Alpa', 'Tidak hadir tanpa kabar'],
];

function Choices({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      {CHOICES.map(([name, hint]) => (
        <Button key={name} variant="secondary" size="52" className="w-full flex-col items-start gap-0 text-left" onClick={onPick}>
          <span>{name}</span>
          <span className="text-small font-medium text-tinta-muted">{hint}</span>
        </Button>
      ))}
    </div>
  );
}

/** Try it: Esc, a tap outside and Batal close it, and focus returns to the row's button. */
export const Playground: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>Gilang Ramadhan: Hadir</Button>
        <Sheet open={open} onOpenChange={setOpen} eyebrow="Pilih kehadiran untuk" title="Gilang Ramadhan"><Choices onPick={() => setOpen(false)} /></Sheet>
      </>
    );
  },
};

export const PilihKehadiran: Story = { args: { eyebrow: 'Pilih kehadiran untuk', title: 'Gilang Ramadhan', children: <Choices onPick={() => undefined} /> } };
