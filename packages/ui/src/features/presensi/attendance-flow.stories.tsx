import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { AttendanceFlow, type FlowStudent } from './attendance-flow';
import type { Mark } from './reducer';

const NAMES = ['Adinda Saraswati', 'Ahmad Fauzan', 'Anisa Rahmawati', 'Bagas Wicaksono', 'Bayu Firmansyah', 'Citra Maharani', 'Daffa Alfarizi', 'Eka Prasetyo', 'Farah Nabila', 'Gilang Ramadhan', 'Hana Safitri', 'Ilham Kurniawan', 'Intan Permata', 'Joko Susilo', 'Kevin Santoso', 'Laila Fitriani', 'Muhammad Iqbal', 'Nabila Zahra', 'Oktaviani Dewi', 'Putri Ayu Lestari', 'Rafi Hidayat', 'Rizky Maulana', 'Sekar Ayuningtyas', 'Tegar Pamungkas', 'Yusuf Habibie'];

function students(preset: Record<number, { mark: Mark; fixed?: boolean; detail?: string }> = {}): FlowStudent[] {
  return NAMES.map((name, i) => ({ id: `s${i + 1}`, name, mark: preset[i + 1]?.mark ?? '?', fixed: preset[i + 1]?.fixed ?? false, detail: preset[i + 1]?.detail }));
}
/** Everyone Hadir except a few: the state after "Semua hadir" and three taps. */
const FILLED: Record<number, { mark: Mark; fixed?: boolean; detail?: string }> = Object.fromEntries(NAMES.map((_, i) => [i + 1, { mark: 'H' }]));
FILLED[5] = { mark: 'T' };
FILLED[20] = { mark: 'A' };
FILLED[22] = { mark: 'I', fixed: true, detail: 'Izin disetujui' };

const meta = {
  title: 'Presensi/Isi presensi',
  component: AttendanceFlow,
  parameters: { layout: 'fullscreen', ownsMain: true },
  args: {
    title: 'X-2 · Matematika',
    subtitle: 'Jam ke-3 · 08.30–09.15',
    dateLabel: 'Senin, 25 Januari',
    shortTitle: 'X-2',
    students: students({ 22: { mark: 'I', fixed: true, detail: 'Izin disetujui' }, 3: { mark: 'H', detail: 'Gerbang' } }),
    backHref: '#hari-ini',
    withTopic: true,
    onSubmit: () => Promise.resolve({ kind: 'sent' }),
  },
} satisfies Meta<typeof AttendanceFlow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Step 2: opened, everyone "Belum diisi" except what an official source filled. The two-step help card is open the first time. */
export const Dibuka: Story = { args: { showHelpFirst: true } };

/** After "Semua hadir" and the exceptions: complete, so the main button is "Periksa dan kirim". */
export const Lengkap: Story = { args: { students: students(FILLED) } };

/** Step 4: one tap on a name opens five big choices. */
export const LembarPilihan: Story = { args: { students: students(FILLED), initialView: { sheetFor: 's10' } } };

/** Step 5: check before sending. */
export const Periksa: Story = { args: { students: students(FILLED), initialView: { review: true } } };

/** Step 6: sent, with the way on. */
export const Terkirim: Story = { args: { students: students(FILLED), initialView: { sent: true }, next: { label: 'X-3 · Fisika, 09.15', href: '#next' } } };

/** Step 7: no signal. The yellow banner says what happens to the answers, and the main button becomes "Simpan presensi di HP". */
export const TanpaSinyal: Story = {
  args: {
    students: students(FILLED),
    offline: true,
    banner: (
      <Banner kind="offline" title="Tidak ada sinyal" className="rounded-none border-x-0">
        Presensi disimpan di HP dan dikirim otomatis saat sinyal kembali.
      </Banner>
    ),
  },
};

/** Step 7, the sheet: it says the answers stay on this phone and the button is "Simpan di HP". */
export const TanpaSinyalPeriksa: Story = { args: { students: students(FILLED), offline: true, initialView: { review: true } } };

/** After "Simpan presensi di HP": "Tersimpan di HP" with the "Menunggu · n" badge. */
export const TersimpanDiHp: Story = { args: { students: students(FILLED), offline: true, waitingCount: 2, initialView: { saved: true }, next: { label: 'X-3 · Fisika, 09.15', href: '#next' } } };

export const FilterBelum: Story = { args: { initialView: { filter: 'unfilled' } } };
export const FilterTidakHadir: Story = { args: { students: students(FILLED), initialView: { filter: 'absent' } } };

/** A locked session: plain rows, and the way out is a correction. */
export const Terkunci: Story = {
  args: {
    students: students(FILLED),
    readOnly: true,
    readOnlyNote: (
      <div className="flex flex-col items-start gap-2 rounded-md border border-garis bg-kapur-raised p-4">
        <p className="m-0 text-body">Sesi ini sudah dikunci. Perubahan diajukan sebagai koreksi dan disetujui wakasek.</p>
        <Button variant="secondary">Ajukan koreksi</Button>
      </div>
    ),
  },
};
