import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './banner';
import { Button } from './button';

const meta = { title: 'Primitif/Banner', component: Banner, args: { children: 'Pesan' } } satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { kind: 'info', children: 'Presensi hari ini sudah dibuka.' } };

export const AllKinds: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <Banner kind="info">Presensi hari ini sudah dibuka.</Banner>
      <Banner kind="warning" title="Belum selesai">Ada 4 siswa yang belum diisi.</Banner>
      <Banner kind="offline" action={<Button variant="secondary">Coba lagi</Button>}>Tidak ada sinyal. Jawaban disimpan di HP dan dikirim saat sinyal kembali.</Banner>
      <Banner kind="error" title="Tidak terkirim">Presensi belum masuk. Periksa sinyal, lalu coba lagi.</Banner>
    </div>
  ),
};
