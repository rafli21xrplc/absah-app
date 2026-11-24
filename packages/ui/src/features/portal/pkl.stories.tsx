import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { Field, Input, Textarea } from '../../components/field';
import { PageMain } from '../../components/frames';

const meta = { title: 'Portal/PKL siswa', component: Card, parameters: { layout: 'fullscreen', ownsMain: true } } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

const Place = () => (
  <Card as="section" aria-label="Tempat PKL" className="flex flex-col gap-1">
    <strong className="text-body-strong">PT Mitra Teknik Jaya</strong>
    <span className="text-body text-tinta-muted">Jl. Raya Industri No. 14, Cikarang</span>
    <span className="text-body">Jam kerja hari ini 08.00–16.00</span>
    <span className="text-body">Pembimbing: Bu Nurul (sekolah), Pak Hendra Gunawan (industri)</span>
  </Card>
);

const Journal = () => (
  <Card as="section" aria-labelledby="jurnal-baru">
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <h2 id="jurnal-baru" className="m-0 text-h2">Jurnal hari ini</h2>
      <Field label="Kegiatan">
        <Textarea name="activity" rows={4} defaultValue="Memasang kabel LAN di lantai 2 bersama teknisi." />
      </Field>
      <Field label="Kompetensi yang dilatih (boleh kosong)">
        <Input name="competency" />
      </Field>
      <Field label="Foto atau PDF (boleh kosong)">
        <Input name="file" type="file" accept="image/*,application/pdf" />
      </Field>
      <Button type="submit">Kirim jurnal</Button>
    </form>
  </Card>
);

/** Before check-in: the one big button, and where the location is read (only on the press). */
export const SebelumCheckIn: Story = {
  render: () => (
    <PageMain>
      <a href="#portal" className="text-body-strong text-papan">← Portal</a>
      <h1 className="m-0 text-h1">PKL</h1>
      <Place />
      <Card as="section" aria-label="Kehadiran hari ini" className="flex flex-col gap-3">
        <h2 className="m-0 text-h2">Kehadiran hari ini</h2>
        <Button size="64">Check-in sekarang</Button>
        <p className="m-0 text-small text-tinta-muted">Lokasi hanya dibaca saat tombol ditekan, dalam radius 150 m dari DUDI.</p>
      </Card>
      <Journal />
    </PageMain>
  ),
};

/** After check-in: what was recorded and by whom it still waits; the button becomes Check-out. */
export const SudahCheckIn: Story = {
  render: () => (
    <PageMain>
      <a href="#portal" className="text-body-strong text-papan">← Portal</a>
      <h1 className="m-0 text-h1">PKL</h1>
      <Place />
      <Card as="section" aria-label="Kehadiran hari ini" className="flex flex-col gap-3">
        <h2 className="m-0 text-h2">Kehadiran hari ini</h2>
        <p role="status" className="m-0 text-body">Datang 07.54 · 42 m dari DUDI · Menunggu pembimbing industri</p>
        <Button size="64" variant="secondary">Check-out pulang</Button>
        <p className="m-0 text-small text-tinta-muted">Lokasi hanya dibaca saat tombol ditekan, dalam radius 150 m dari DUDI.</p>
      </Card>
      <Journal />
    </PageMain>
  ),
};
