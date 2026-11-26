import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Monitor } from 'lucide-react';
import { Button } from './button';
import { PageHeader } from './page-header';

const meta = { title: 'Kerangka/PageHeader', component: PageHeader, args: { title: 'Hari ini' } } satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: {
    title: 'Hari ini',
    date: { label: 'Senin, 25 Januari 2027', onPrev: () => undefined, onNext: () => undefined, nextDisabled: true },
    updated: 'Diperbarui 09.42 · semester genap 2026/2027',
    actions: (
      <>
        <Button variant="outline">
          <Monitor aria-hidden className="size-4" />
          Papan kedatangan
        </Button>
        <Button>
          <Download aria-hidden className="size-4" />
          Unduh rekap hari ini
        </Button>
      </>
    ),
  },
};

export const HanyaHariIni: Story = { args: { title: 'Presensi kelas', date: { label: 'Senin, 25 Januari 2027' }, updated: 'Diperbarui 09.42' } };
