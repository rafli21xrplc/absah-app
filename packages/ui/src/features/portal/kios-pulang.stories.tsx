import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../components/button';
import { Card } from '../../components/card';

const meta = { title: 'Kios/Pulang', component: Card, parameters: { layout: 'fullscreen', ownsMain: true } } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

const GUARDIANS: [string, string][] = [['Pak Darto', 'Sopir'], ['Bu Sari', 'Ibu'], ['Pak Hadi', 'Ayah']];
const Photo = ({ name }: { name: string }) => <span role="img" aria-label={`Foto ${name}`} className="block aspect-[3/4] w-full rounded-lg bg-garis" />;

/** The student's penjemput as large photo buttons, read from the morning download (works offline). */
export const PilihPenjemput: Story = {
  render: () => (
    <main className="flex min-h-dvh flex-col items-center gap-6 p-6 text-center">
      <h1 className="m-0 text-display">Aditya · VII A</h1>
      <p className="m-0 text-h2 text-tinta-muted">Pilih penjemput yang hadir:</p>
      <div className="grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(11rem,13rem))] justify-center gap-4">
        {GUARDIANS.map(([n, r]) => (
          <button key={n} type="button" className="flex min-h-16 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-papan bg-kapur-raised p-3 text-body text-tinta">
            <Photo name={n} />
            <span className="text-h2">{n}</span>
            <small className="text-body text-tinta-muted">{r}</small>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="64" variant="secondary">Penjemput tidak terdaftar</Button>
        <Button size="64" variant="ghost">Batal</Button>
      </div>
    </main>
  ),
};

export const Konfirmasi: Story = {
  render: () => (
    <main className="flex min-h-dvh flex-col items-center p-6 text-center">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <Photo name="Pak Darto" />
        <h1 className="m-0 text-h1">Aditya pulang bersama Pak Darto?</h1>
        <Button size="64" className="w-full">Konfirmasi</Button>
        <Button size="64" variant="secondary" className="w-full">Kembali</Button>
      </div>
    </main>
  ),
};
