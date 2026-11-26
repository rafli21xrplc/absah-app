import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertTriangle, Bell, CheckCircle2, ClipboardCheck, MessageCircle, ScanLine, Utensils } from 'lucide-react';
import { Avatar } from '../../components/avatar';
import { Button } from '../../components/button';
import { Chip } from '../../components/chip';
import { StackBar } from '../../components/stack-bar';
import { BoardSection } from './board';
import { ActivityFeed, Histogram, HeroRingCard, ListCardList, ListCardRow, StatGroupCard, TrendBarChart } from './v3';
import { ARRIVALS, TREND } from './v3.fixtures';

const meta = { title: 'Papan/v3' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = 'grid max-w-360 gap-4 bg-latar-app p-6 lg:grid-cols-[320px_1fr_1fr]';

export const Normal: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-latar-app">
      <div className={frame}>
        <HeroRingCard
          title="Kehadiran hari ini"
          badge="900 siswa aktif"
          rate={0.958}
          value="862"
          lines={['hadir tepat waktu dari 900 siswa', '+14 telat · 24 tidak hadir']}
          spark={TREND.map((d) => d.value ?? 0)}
          target={0.95}
          note="0,8 poin di atas target sekolah"
        />
        <StatGroupCard
          title="Masuk sekolah"
          icon={CheckCircle2}
          aside="dibanding kemarin"
          stats={[
            { label: 'Hadir', value: 862, dot: 'hadir', delta: { direction: 'up', meaning: 'good', text: '12', label: 'naik 12 siswa dibanding kemarin' } },
            { label: 'Telat', value: 14, dot: 'telat', delta: { direction: 'down', meaning: 'good', text: '6', label: 'turun 6 siswa dibanding kemarin' } },
            { label: 'Pulang awal', value: 3, dot: 'muted', delta: { direction: 'flat', meaning: 'neutral', text: '0', label: 'sama dengan kemarin' } },
          ]}
          bar={
            <StackBar
              label="Masuk sekolah"
              parts={[
                { value: 862, label: 'Hadir', tone: 'hadir' },
                { value: 14, label: 'Telat', tone: 'telat' },
                { value: 3, label: 'Pulang awal', tone: 'muted' },
              ]}
            />
          }
          footer="876 siswa di sekolah"
          footerEnd="rata-rata telat 9 menit"
        >
          <Histogram bins={ARRIVALS} label="Jam datang" caption="bel masuk 07.00" />
        </StatGroupCard>
        <StatGroupCard
          title="Tidak hadir"
          icon={AlertTriangle}
          iconTone="alpa"
          aside="dibanding kemarin"
          stats={[
            { label: 'Izin', value: 9, dot: 'izin', delta: { direction: 'up', meaning: 'bad', text: '4', label: 'naik 4 siswa' } },
            { label: 'Sakit', value: 7, dot: 'sakit', delta: { direction: 'down', meaning: 'good', text: '2', label: 'turun 2 siswa' } },
            { label: 'Alpa', value: 8, dot: 'alpa', delta: { direction: 'down', meaning: 'good', text: '3', label: 'turun 3 siswa' } },
          ]}
          bar={
            <StackBar
              label="Tidak hadir"
              parts={[
                { value: 9, label: 'Izin', tone: 'izin' },
                { value: 7, label: 'Sakit', tone: 'sakit' },
                { value: 8, label: 'Alpa', tone: 'alpa' },
              ]}
            />
          }
          footer="24 siswa tidak hadir"
          footerEnd="4 izin menunggu persetujuan"
        />
      </div>
      <div className="grid max-w-360 gap-4 px-6 pb-6 lg:grid-cols-[2fr_1fr]">
        <BoardSection title="Tren kehadiran" subtitle="Persentase siswa hadir per hari sekolah" state="ready">
          <TrendBarChart data={TREND} target={0.95} caption="Januari 2027" />
        </BoardSection>
        <div className="flex flex-col gap-4">
          <BoardSection title="Perlu perhatian" subtitle="Peringatan dini dari pola kehadiran" count="3 siswa" state="ready">
            <ListCardList>
              <ListCardRow lead={<Avatar name="Fajar Nugroho" seed="fn" />} title="Fajar Nugroho" tags={<Chip tone="alpa">Alpa</Chip>} detail="Alpa 3 hari berturut-turut" />
              <ListCardRow lead={<Avatar name="Salsa Amelia" seed="sa" />} title="Salsa Amelia" tags={<Chip tone="telat">Cek jam</Chip>} detail="Masuk gerbang 06.55, tidak ada di jam ke-2" />
            </ListCardList>
          </BoardSection>
          <BoardSection title="Aktivitas terbaru" subtitle="Dari gerbang, guru, dan orang tua" state="ready">
            <ActivityFeed
              moreHref="#"
              items={[
                { key: '1', at: '2027-01-25T09:42:00+07:00', timeLabel: '09.42', icon: Bell, title: 'Pengingat terkirim', detail: 'WhatsApp ke Bu Ratna' },
                { key: '2', at: '2027-01-25T09:31:00+07:00', timeLabel: '09.31', icon: ClipboardCheck, title: 'Presensi jam ke-2 terisi' },
                { key: '3', at: '2027-01-25T08:41:00+07:00', timeLabel: '08.41', icon: ScanLine, title: 'Kios gerbang tersinkron' },
                { key: '4', at: '2027-01-25T08:30:00+07:00', timeLabel: '08.30', icon: Utensils, title: 'Porsi dikirim ke PIC' },
                { key: '5', at: '2027-01-25T07:45:00+07:00', timeLabel: '07.45', icon: MessageCircle, title: 'Izin diajukan' },
              ]}
            />
          </BoardSection>
        </div>
      </div>
    </div>
  ),
};

export const Keadaan: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-4 bg-latar-app p-6 md:grid-cols-2">
      <BoardSection title="Tren kehadiran" state="loading" />
      <BoardSection title="Perlu perhatian" state="empty" emptyText="Tidak ada siswa yang perlu diperhatikan hari ini." />
      <BoardSection title="Sesi belum diisi" state="error" onRetry={() => undefined} />
      <BoardSection title="Izin menunggu" state="offline" onRetry={() => undefined} />
      <BoardSection title="Izin menunggu persetujuan" count="4 pengajuan" state="ready" action={<Button variant="outline" size="40">Lihat semua</Button>}>
        <p className="m-0 text-small">Isi daftar.</p>
      </BoardSection>
    </div>
  ),
};
