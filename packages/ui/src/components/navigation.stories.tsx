import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDays, Clock, House, User } from 'lucide-react';
import { useState } from 'react';
import { BottomNav } from './bottom-nav';
import { SegmentedControl } from './segmented-control';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta = { title: 'Primitif/Navigasi', component: BottomNav, args: { items: [] as never } } satisfies Meta<typeof BottomNav>;
export default meta;
type Story = StoryObj<typeof meta>;

const icon = (I: typeof House) => <I aria-hidden strokeWidth={1.75} className="size-6" />;

export const BilahBawah: Story = {
  render: () => (
    <div className="max-w-sm overflow-hidden rounded-lg border border-garis">
      <BottomNav
        items={[
          { key: 'hari-ini', label: 'Hari ini', href: '#hari-ini', icon: icon(House), current: true },
          { key: 'jadwal', label: 'Jadwal', href: '#jadwal', icon: icon(CalendarDays) },
          { key: 'riwayat', label: 'Riwayat', href: '#riwayat', icon: icon(Clock) },
          { key: 'akun', label: 'Akun', href: '#akun', icon: icon(User) },
        ]}
      />
    </div>
  ),
};

export const TabBagian: Story = {
  render: () => (
    <Tabs defaultValue="jadwal" className="flex max-w-xl flex-col gap-4">
      <TabsList label="Bagian jadwal">
        <TabsTrigger value="jadwal">Jadwal pelajaran</TabsTrigger>
        <TabsTrigger value="jam">Jam pelajaran</TabsTrigger>
        <TabsTrigger value="wali">Wali kelas</TabsTrigger>
      </TabsList>
      <TabsContent value="jadwal">Grid jadwal per rombel.</TabsContent>
      <TabsContent value="jam">Jam ke-n per hari.</TabsContent>
      <TabsContent value="wali">Pilih wali kelas per rombel.</TabsContent>
    </Tabs>
  ),
};

export const FilterStatus: Story = {
  render: () => {
    const [v, setV] = useState<'aktif' | 'keluar' | 'semua'>('aktif');
    return <SegmentedControl label="Status" value={v} onChange={setV} options={[{ value: 'aktif', label: 'Aktif' }, { value: 'keluar', label: 'Keluar' }, { value: 'semua', label: 'Semua' }]} />;
  },
};
