import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarCheck, FileText, LayoutGrid, UserRound } from 'lucide-react';
import { Banner } from './banner';
import { BottomNav } from './bottom-nav';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { AppShell, PageMain } from './frames';
import { SkeletonRows } from './skeleton';
import { GreetingHeader, SessionGroup, SessionHero, SessionItem } from './today';

const meta = { title: 'Kerangka/Beranda guru', component: SessionHero, parameters: { layout: 'fullscreen', ownsMain: true }, args: { title: 'X-2 · Matematika', href: '#sesi' } } satisfies Meta<typeof SessionHero>;
export default meta;
type Story = StoryObj<typeof meta>;

const ic = (I: typeof CalendarCheck) => <I aria-hidden strokeWidth={1.75} className="size-6" />;
const bar = (
  <BottomNav
    items={[
      { key: 'hari-ini', label: 'Hari ini', href: '#hari-ini', icon: ic(CalendarCheck), current: true },
      { key: 'izin', label: 'Izin', href: '#izin', icon: ic(FileText) },
      { key: 'menu', label: 'Menu', href: '#menu', icon: ic(LayoutGrid) },
      { key: 'akun', label: 'Akun', href: '#akun', icon: ic(UserRound) },
    ]}
  />
);

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <AppShell sidebar={<span>Menu samping</span>} bottomBar={bar}>
      <PageMain>
        <GreetingHeader date="Senin, 25 Januari 2027" greeting="Selamat pagi, Sari" />
        {children}
      </PageMain>
    </AppShell>
  );
}

const next = (
  <SessionGroup title="Berikutnya">
    <SessionItem variant="next" time="09.15" title="X-3 · Fisika" meta="Jam ke-4 · 25 siswa" href="#a" />
    <SessionItem variant="next" time="10.30" title="XI-1 · Matematika" meta="Jam ke-6 · 25 siswa" href="#b" />
  </SessionGroup>
);
const done = (
  <SessionGroup title="Sudah selesai">
    <SessionItem variant="done" time="07.00–07.45" title="X-1 · Matematika" meta="Terkirim · 24 siswa · 1 tidak hadir" href="#c" />
  </SessionGroup>
);

/** The default day: one session in progress with the one big button, then what is next, then what is done. */
export const SedangBerlangsung: Story = {
  render: () => (
    <Phone>
      <SessionHero time="08.30–09.15" title="X-2 · Matematika" meta="Jam ke-3 · 25 siswa" href="#sesi" />
      {next}
      {done}
    </Phone>
  ),
};

/** Between two lessons nothing is in progress, so there is no big button. */
export const JedaAntarSesi: Story = {
  render: () => (
    <Phone>
      <SessionGroup title="Belum diisi">
        <SessionItem variant="unfilled" time="07.45–08.30" title="X-4 · Biologi" meta="Jam ke-2 · 25 siswa" href="#x" />
      </SessionGroup>
      {next}
      {done}
    </Phone>
  ),
};

export const Semua: Story = {
  render: () => (
    <Phone>
      <SessionGroup title="Sudah selesai">
        <SessionItem variant="done" time="07.00–07.45" title="X-1 · Matematika" meta="Terkirim · 24 siswa" href="#c" />
        <SessionItem variant="missed" time="07.45–08.30" title="X-4 · Biologi" meta="Jam ke-2 · 25 siswa" href="#d" />
        <SessionItem variant="locked" time="08.30–09.15" title="X-2 · Matematika" meta="Terkirim · 25 siswa" href="#e" />
      </SessionGroup>
    </Phone>
  ),
};

export const Memuat: Story = { render: () => <Phone><SkeletonRows count={3} /></Phone> };
export const Kosong: Story = { render: () => <Phone><EmptyState title="Tidak ada jadwal mengajar hari ini">Jadwal muncul di sini pada hari mengajar.</EmptyState></Phone> };
export const Galat: Story = { render: () => <Phone><ErrorState title="Jadwal belum bisa dimuat" onRetry={() => undefined}>Data Anda aman. Coba lagi sebentar lagi.</ErrorState></Phone> };
export const TanpaSinyal: Story = {
  render: () => (
    <Phone>
      <Banner kind="offline">Daftar dari salinan di HP (pukul 07.58). Sesi yang diisi dikirim otomatis saat sinyal kembali.</Banner>
      <SessionHero time="08.30–09.15" title="X-2 · Matematika" meta="Jam ke-3 · 25 siswa" href="#sesi" />
      {next}
    </Phone>
  ),
};
