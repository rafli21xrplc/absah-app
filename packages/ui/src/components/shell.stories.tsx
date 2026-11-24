import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarCheck, DoorOpen, FileText, GraduationCap, Settings, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { AppShell, ErrorPage, LoadingPage, NotFoundPage, PortalFrame } from './frames';
import { Sheet } from './sheet';
import { SideNav, type SideNavGroup } from './side-nav';

const meta = { title: 'Kerangka/Halaman', component: AppShell, parameters: { layout: 'fullscreen' }, args: { sidebar: null, children: null } } satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;

const ic = (I: typeof Users) => <I aria-hidden strokeWidth={1.75} className="size-5" />;
const GROUPS: SideNavGroup[] = [
  { key: 'inti', items: [
    { key: 'hari-ini', label: 'Presensi kelas', href: '#hari-ini', icon: ic(CalendarCheck), current: true },
    { key: 'gerbang', label: 'Gerbang', href: '#gerbang', icon: ic(DoorOpen) },
    { key: 'izin', label: 'Izin', href: '#izin', icon: ic(FileText) },
  ] },
  { key: 'data', title: 'DATA SEKOLAH', items: [
    { key: 'siswa', label: 'Siswa', href: '#siswa', icon: ic(Users) },
    { key: 'rombel', label: 'Rombel', href: '#rombel', icon: ic(GraduationCap) },
  ] },
  { key: 'pengaturan', items: [{ key: 'setup', label: 'Pengaturan sekolah', href: '#setup', icon: ic(Settings) }] },
];

function School() {
  return (
    <div className="flex flex-col">
      <span className="text-body-strong">SMK Negeri 1 Contoh</span>
      <span className="text-small text-tinta-muted">SMK/MAK</span>
    </div>
  );
}

function Phone() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" onClick={() => setOpen(true)} aria-haspopup="dialog">Menu</Button>
        <School />
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="Menu">
        <SideNav groups={GROUPS} onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/** Laptop: 240 px menu column. Narrow the window under 1024 px: the column goes and the top bar with a Menu button appears. */
export const WebStaf: Story = {
  render: () => (
    <AppShell sidebar={<><School /><SideNav groups={GROUPS} /></>} topBar={<Phone />}>
      <div className="p-6">
        <h1 className="m-0 text-h1">Presensi kelas</h1>
        <EmptyState title="Belum ada sesi hari ini" headingLevel="h2" className="mt-4">Sesi muncul saat jadwal hari ini dibuat.</EmptyState>
      </div>
    </AppShell>
  ),
};

export const Portal: Story = {
  render: () => (
    <PortalFrame>
      <div className="flex flex-col gap-4 p-4">
        <h1 className="m-0 text-h1">Kehadiran anak</h1>
        <EmptyState title="Belum ada data">Data muncul setelah guru mengisi presensi.</EmptyState>
      </div>
    </PortalFrame>
  ),
};

export const Memuat: Story = { parameters: { ownsMain: true }, render: () => <LoadingPage /> };
export const Galat: Story = { parameters: { ownsMain: true }, render: () => <ErrorPage onRetry={() => undefined} /> };
export const TidakDitemukan: Story = { parameters: { ownsMain: true }, render: () => <NotFoundPage /> };
