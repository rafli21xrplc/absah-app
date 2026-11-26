import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageCircle, ScanLine, UserRound } from 'lucide-react';
import { Avatar } from './avatar';
import { Button } from './button';
import { Card } from './card';
import { Chip, StatusChip } from './chip';
import { DeltaPill } from './delta-pill';
import { ProgressBar } from './progress-bar';
import { StackBar } from './stack-bar';

const meta = { title: 'Primitif/v3' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const NAMES = ['Gilang Ramadhan', 'Putri Ayu Lestari', 'Bayu Firmansyah', 'Nadia Putri', 'Fajar Nugroho', 'Salsa Amelia'];

export const Normal: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-4 bg-latar-app p-6">
      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="m-0 text-judul-kartu">Kartu v3</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Tambah presensi manual</Button>
          <Button variant="soft">Ingatkan</Button>
          <Button variant="outline">Laporan presensi</Button>
          <Button variant="ghost">Lihat semua</Button>
          <Button variant="outline" size="40">
            Tolak
          </Button>
          <Button size="36">Setujui</Button>
          <Button disabled>Nonaktif</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip code="H" />
          <StatusChip code="T" label="Telat 14 m" />
          <StatusChip code="I" />
          <StatusChip code="S" />
          <StatusChip code="A" />
          <StatusChip code="?" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="papan" square>
            X-2
          </Chip>
          <Chip icon={ScanLine}>Gerbang</Chip>
          <Chip icon={MessageCircle}>WhatsApp ortu</Chip>
          <Chip icon={UserRound}>Guru</Chip>
          <Chip tone="stabilo">6 sesi</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeltaPill direction="up" meaning="good" text="0,8" label="naik 0,8 poin" />
          <DeltaPill direction="down" meaning="good" text="6" label="turun 6 siswa" />
          <DeltaPill direction="up" meaning="bad" text="4" label="naik 4 siswa" />
          <DeltaPill direction="flat" meaning="neutral" text="0" label="sama dengan kemarin" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {NAMES.map((n, i) => (
            <Avatar key={n} name={n} seed={`id-${i}`} size={([30, 36, 38, 40] as const)[i % 4]} />
          ))}
        </div>
        <ProgressBar bare label="Kehadiran" value={95.8} max={100} text="95,8%" target={95} />
        <StackBar
          label="Tidak hadir"
          parts={[
            { value: 9, label: 'Izin', tone: 'izin' },
            { value: 7, label: 'Sakit', tone: 'sakit' },
            { value: 8, label: 'Alpa', tone: 'alpa' },
          ]}
        />
      </Card>
    </div>
  ),
};

export const Kosong: Story = {
  render: () => (
    <Card padding="lg" className="flex max-w-md flex-col gap-3">
      <ProgressBar bare label="Sesi terisi" value={0} max={104} text="0 dari 104 sesi" />
      <StackBar label="Tidak hadir" parts={[]} />
      <StatusChip code="?" />
    </Card>
  ),
};

export const Fokus: Story = {
  render: () => (
    <div className="flex gap-2 p-6">
      <Button autoFocus>Fokus</Button>
      <Button variant="outline">Outline</Button>
    </div>
  ),
};
