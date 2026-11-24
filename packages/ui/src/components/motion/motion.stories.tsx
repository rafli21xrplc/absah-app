import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Banner } from '../banner';
import { Button } from '../button';
import { Table, TableBody, TableHead, TableRow, Td, Th } from '../table';
import { CheckDraw } from './check-draw';
import { CountdownRing } from './countdown-ring';
import { Spinner } from './spinner';
import { StepList } from './step-list';
import { useShake } from './use-shake';

const meta = { title: 'Gerak/Komponen', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-md border border-garis bg-kapur-raised p-4">
    <p className="m-0 text-body-strong text-tinta">{title}</p>
    {children}
  </section>
);

export const Spinners: Story = {
  name: 'Spinner (kartu 2)',
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Frame title="Di atas kapur">
        <Spinner />
      </Frame>
      <Frame title="Di atas tombol utama">
        <Button loading>Memeriksa…</Button>
      </Frame>
      <Frame title="Tombol nonaktif tidak memutar">
        <Button disabled disabledReason="Isi email dulu.">
          Masuk
        </Button>
      </Frame>
    </div>
  ),
};

export const Centang: Story = {
  name: 'Centang tergambar (kartu 3)',
  render: () => (
    <Frame title="Sekali saja, lalu diam">
      <CheckDraw />
    </Frame>
  ),
};

export const Langkah: Story = {
  name: 'Langkah berurutan (kartu 4)',
  render: () => (
    <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      <Frame title="Mulai">
        <StepList
          label="Menyiapkan Beranda, mulai"
          steps={[
            { id: 'a', label: 'Akun dikenali', status: 'running' },
            { id: 'b', label: 'Membuka SMA Absah Uji', status: 'waiting' },
            { id: 'c', label: 'Menyiapkan jadwal hari ini', status: 'waiting' },
          ]}
        />
      </Frame>
      <Frame title="Tengah">
        <StepList
          label="Menyiapkan Beranda, tengah"
          steps={[
            { id: 'a', label: 'Akun dikenali', status: 'done' },
            { id: 'b', label: 'Membuka SMA Absah Uji', status: 'running' },
            { id: 'c', label: 'Menyiapkan jadwal hari ini', status: 'waiting' },
          ]}
        />
      </Frame>
      <Frame title="Selesai">
        <StepList
          label="Menyiapkan Beranda, selesai"
          steps={[
            { id: 'a', label: 'Akun dikenali', status: 'done' },
            { id: 'b', label: 'Membuka SMA Absah Uji', status: 'done' },
            { id: 'c', label: 'Menyiapkan jadwal hari ini', status: 'done' },
          ]}
        />
      </Frame>
    </div>
  ),
};

export const Hitungmundur: Story = {
  name: 'Cincin hitung mundur (kartu 5)',
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Frame title="Kirim ulang dalam">
        <p className="m-0 flex items-center gap-2 text-body text-tinta-muted">
          Kirim ulang tautan dalam <CountdownRing seconds={60} />
        </p>
      </Frame>
      <Frame title="Dua menit (Masih di sini?)">
        <CountdownRing seconds={120} size={32} />
      </Frame>
    </div>
  ),
};

function ShakeDemo() {
  const [wrong, setWrong] = useState(0);
  const shake = useShake(wrong);
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <div className={shake}>
        <Banner kind="error" title="Kata sandi belum cocok">
          Periksa huruf besar dan kecil.
        </Banner>
      </div>
      <Button variant="secondary" onClick={() => setWrong((n) => n + 1)}>
        Salah lagi
      </Button>
    </div>
  );
}

export const Getar: Story = {
  name: 'Getar dan banner turun (kartu 1 dan 7)',
  render: () => (
    <Frame title="Setiap ketukan getar lagi; banner turun sekali saat muncul">
      <ShakeDemo />
    </Frame>
  ),
};

const MAP: { no: number; gerak: string; durasi: string; oleh: string }[] = [
  { no: 1, gerak: 'Getar', durasi: 'motion-masuk, 2 kali', oleh: 'useShake + kelas motion-shake-a/b' },
  { no: 2, gerak: 'Tombol sedang bekerja', durasi: 'putar terus', oleh: 'Button loading, Spinner' },
  { no: 3, gerak: 'Centang tergambar', durasi: 'motion-rayakan, sekali', oleh: 'CheckDraw' },
  { no: 4, gerak: 'Langkah berurutan', durasi: 'motion-biasa per tanda', oleh: 'StepList' },
  { no: 5, gerak: 'Cincin hitung mundur', durasi: 'linear, sesuai waktunya', oleh: 'CountdownRing' },
  { no: 6, gerak: 'Syarat menyala', durasi: 'motion-biasa, jeda 150 ms', oleh: 'RuleList (UA3)' },
  { no: 7, gerak: 'Banner turun', durasi: 'motion-biasa', oleh: 'Banner (kelas motion-banner-in)' },
  { no: 8, gerak: 'Lembar naik', durasi: 'motion-biasa', oleh: 'Sheet (U2b), tidak diubah' },
  { no: 9, gerak: 'Baris masuk dan angka naik', durasi: 'motion-masuk, jeda 60 ms', oleh: 'Kelas motion-row-in; papan contoh di layar masuk (UA2)' },
  { no: 10, gerak: 'Status berganti', durasi: 'motion-cepat', oleh: 'Belum ada: dipasang di StatusPill saat U4 butuh' },
  { no: 11, gerak: 'Urungkan yang menyusut', durasi: '7 detik, linear', oleh: 'Toast (U2b) menunjukkan sisa waktu; garis menyusut belum' },
  { no: 12, gerak: 'Status sinkron', durasi: 'motion-biasa', oleh: 'Banner kind offline lalu info (halaman yang memakainya)' },
];

export const PetaGerak: Story = {
  name: 'Peta 12 gerak',
  render: () => (
    <Table caption="Dua belas gerak di papan Motion-UI dan komponen yang memenuhinya">
      <TableHead>
        <TableRow>
          <Th>No</Th>
          <Th>Gerak</Th>
          <Th>Lama</Th>
          <Th>Dipenuhi oleh</Th>
        </TableRow>
      </TableHead>
      <TableBody>
        {MAP.map((m) => (
          <TableRow key={m.no}>
            <Td>{m.no}</Td>
            <Td>{m.gerak}</Td>
            <Td>{m.durasi}</Td>
            <Td>{m.oleh}</Td>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
