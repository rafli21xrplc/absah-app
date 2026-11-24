import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { Field, Input, Select, Textarea } from '../../components/field';
import { PageMain } from '../../components/frames';

const meta = { title: 'Portal/Lapor TPPK', component: Card, parameters: { layout: 'fullscreen', ownsMain: true } } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

const CHOICES: [string, string][] = [
  ['Perundungan', 'Diejek, dikucilkan, atau dipukul berulang kali'],
  ['Kekerasan seksual', 'Disentuh, dilihat, atau diajak bicara yang tidak pantas'],
  ['Kekerasan fisik', 'Dipukul, ditendang, atau disakiti badan'],
];

/** The form on a phone: calm, short, anonymous by default. The safety note is first, in words, not red. */
export const Formulir: Story = {
  render: () => (
    <PageMain>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h1">Lapor ke TPPK</h1>
        <p className="m-0 text-body text-tinta-muted">SMP Negeri 2 Contoh</p>
      </div>
      <p className="m-0 text-body">Laporan hanya dibaca oleh Tim Pencegahan dan Penanganan Kekerasan (TPPK) sekolah. Kepala sekolah dan wali kelas tidak menerimanya otomatis. Anda boleh melapor tanpa nama.</p>
      <Banner kind="warning" title="Jika Anda dalam bahaya sekarang">Segera cari orang dewasa yang Anda percaya, atau telepon 112. Layanan SAPA 129 juga bisa dihubungi.</Banner>
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-small font-semibold text-tinta">Apa yang terjadi?</legend>
          {CHOICES.map(([l, h], i) => (
            <label key={l} className="grid min-h-11 grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 rounded-md border border-garis-kuat bg-kapur-raised px-3 py-2 text-body text-tinta">
              <input type="radio" name="category" defaultChecked={i === 0} className="mt-1 size-5 accent-papan" />
              <span className="text-body-strong">{l}</span>
              <span className="col-start-2 text-small text-tinta-muted">{h}</span>
            </label>
          ))}
        </fieldset>
        <Field label="Ceritakan kejadiannya" hint="Siapa, di mana, kapan, dan apa yang terjadi. Tulis sebisanya.">
          <Textarea rows={5} />
        </Field>
        <Field label="Saya adalah">
          <Select defaultValue="">
            <option value="">Pilih</option>
            <option value="korban">Korban</option>
          </Select>
        </Field>
        <label className="flex items-start gap-3 text-body text-tinta">
          <input type="checkbox" defaultChecked className="mt-1 size-5 accent-papan" />
          <span className="flex flex-col">
            Kirim tanpa nama
            <span className="text-small text-tinta-muted">Nama, akun, dan alamat internet Anda tidak disimpan.</span>
          </span>
        </label>
        <Button type="submit" size="52">Kirim laporan</Button>
      </form>
    </PageMain>
  ),
};

/** After sending: the code is shown once, large, with a copy button. */
export const Diterima: Story = {
  render: () => (
    <PageMain>
      <h1 className="m-0 text-h1">Laporan Anda sudah diterima</h1>
      <p className="m-0 text-body">Terima kasih sudah berani melapor. Tim TPPK SMP Negeri 2 Contoh akan membacanya.</p>
      <p className="m-0 text-body text-tinta-muted">Simpan kode lacak ini untuk melihat perkembangan laporan. Kode ini hanya ditampilkan sekali.</p>
      <p className="m-0 rounded-lg border-2 border-dashed border-papan p-4 text-center font-mono text-h1 tracking-widest">K7Q2M-9XR4D</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary">Salin kode</Button>
        <a href="#lacak" className="text-body-strong text-papan">Lacak laporan</a>
      </div>
    </PageMain>
  ),
};

export const Lacak: Story = {
  render: () => (
    <PageMain>
      <h1 className="m-0 text-h1">Lacak laporan</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Kode lacak">
          <Input defaultValue="K7Q2M-9XR4D" />
        </Field>
        <Button type="submit" size="52">Lihat status</Button>
      </form>
      <Card as="section" role="status" aria-label="Status laporan" className="flex flex-col gap-1">
        <h2 className="m-0 text-h2">Sedang ditangani</h2>
        <p className="m-0 text-body text-tinta-muted">Tim TPPK sudah membaca laporan Anda dan sedang menindaklanjuti.</p>
      </Card>
    </PageMain>
  ),
};
