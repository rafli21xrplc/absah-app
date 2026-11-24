import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../components/button';
import { Field, Input, Select } from '../../components/field';
import { PageMain } from '../../components/frames';
import { ChoiceGroup, PresetSummary, Stepper, WizardNav, type StepperItem } from './setup-parts';

const meta = { title: 'Setup/Wizard jenjang', component: Stepper, parameters: { layout: 'fullscreen', ownsMain: true }, args: { items: [], current: 0, label: 'Langkah setup', skippedText: 'dilewati' } } satisfies Meta<typeof Stepper>;
export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS = (current: number): StepperItem[] =>
  [['profile', 'Profil'], ['level', 'Jenjang'], ['mbg', 'MBG'], ['import', 'Data siswa'], ['gate', 'Gerbang'], ['invite', 'Undang']].map(([id, label], i) => ({ id: id as string, label: label as string, status: i < current ? 'done' : 'todo' }));

export const Profil: Story = {
  render: () => (
    <PageMain width="md">
      <header className="flex flex-col gap-3">
        <p className="m-0 text-small text-tinta-muted">Langkah 1 dari 6 · SD Negeri 3 Contoh</p>
        <Stepper items={ITEMS(0)} current={0} label="Langkah setup" skippedText="dilewati" />
      </header>
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <h1 className="m-0 text-h1">Profil sekolah</h1>
        <Field label="Nama sekolah"><Input defaultValue="SD Negeri 3 Contoh" /></Field>
        <Field label="NPSN" hint="8 angka. Madrasah boleh mengisi NSM saja."><Input defaultValue="20512345" /></Field>
        <Field label="Zona waktu"><Select defaultValue="Asia/Jakarta"><option value="Asia/Jakarta">WIB (Jakarta)</option></Select></Field>
        <WizardNav backLabel="Kembali"><Button type="submit">Simpan dan lanjut</Button></WizardNav>
      </form>
    </PageMain>
  ),
};

/** Level: the answer shows at once what it turns on (the same list the server applies). */
export const Jenjang: Story = {
  render: () => (
    <PageMain width="md">
      <header className="flex flex-col gap-3">
        <p className="m-0 text-small text-tinta-muted">Langkah 2 dari 6 · SD Negeri 3 Contoh</p>
        <Stepper items={ITEMS(1)} current={1} label="Langkah setup" skippedText="dilewati" />
      </header>
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <h1 className="m-0 text-h1">Jenjang sekolah</h1>
        <ChoiceGroup legend="Jenjang" name="level" defaultValue="sd" options={[{ value: 'sd', label: 'SD/MI' }, { value: 'smp', label: 'SMP/MTs' }, { value: 'sma', label: 'SMA/MA' }, { value: 'smk', label: 'SMK/MAK' }]} />
        <ChoiceGroup legend="Madrasah (MI, MTs, MA, MAK)?" name="madrasah" defaultValue="bukan" options={[{ value: 'ya', label: 'Ya, madrasah' }, { value: 'bukan', label: 'Bukan' }]} />
        <PresetSummary title="Yang aktif untuk SD/MI:" items={['Presensi harian', 'Penjemputan dengan penjemput resmi', 'Kartu dipegang orang tua', '7 Kebiasaan Anak Indonesia Hebat']} />
        <WizardNav onBack={() => undefined} backLabel="Kembali"><Button type="submit">Simpan dan lanjut</Button></WizardNav>
      </form>
    </PageMain>
  ),
};

export const MBG: Story = {
  render: () => (
    <PageMain width="md">
      <header className="flex flex-col gap-3">
        <p className="m-0 text-small text-tinta-muted">Langkah 3 dari 6 · SD Negeri 3 Contoh</p>
        <Stepper items={ITEMS(2)} current={2} label="Langkah setup" skippedText="dilewati" />
      </header>
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <h1 className="m-0 text-h1">Penerima Makan Bergizi Gratis?</h1>
        <p className="m-0 text-body text-tinta-muted">Bila ya, Absah menghitung jumlah siswa hadir untuk laporan MBG. Jam batas dan nomor PIC bisa diisi nanti.</p>
        <ChoiceGroup legend="Sekolah menerima MBG" name="mbg" required defaultValue="ya" options={[{ value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak' }]} />
        <WizardNav onBack={() => undefined} backLabel="Kembali"><Button type="submit">Simpan dan lanjut</Button></WizardNav>
      </form>
    </PageMain>
  ),
};
