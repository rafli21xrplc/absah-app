import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from '../../components/card';
import { PageMain } from '../../components/frames';
import { SegmentedControl } from '../../components/segmented-control';
import { ChildTabs, CountsRow, LinkRow, StatusChip } from './portal-parts';

const meta = { title: 'Portal/Beranda orang tua', component: LinkRow, parameters: { layout: 'fullscreen', ownsMain: true }, args: { href: '#', title: 'Judul' } } satisfies Meta<typeof LinkRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const DAYS: [string, 'H' | 'T' | 'I' | 'S' | 'A'][] = [['Sen, 25 Jan', 'H'], ['Jum, 22 Jan', 'H'], ['Kam, 21 Jan', 'T'], ['Rab, 20 Jan', 'H'], ['Sel, 19 Jan', 'S'], ['Sen, 18 Jan', 'H']];

/** The parent's home on a phone: who, today, the menu, the history. Compare with design/boards/Ortu-portal-sd.dc.html. */
export const Beranda: Story = {
  render: () => (
    <PageMain>
      <header className="flex flex-col gap-1">
        <p className="m-0 text-small text-tinta-muted">SD Negeri 3 Contoh</p>
        <h1 className="m-0 text-h1">Halo, Hartono</h1>
      </header>
      <ChildTabs items={[{ key: 'a', label: 'ADITYA · 4A' }, { key: 'b', label: 'BUNGA · 2B' }]} selectedKey="a" onSelect={() => undefined} />
      <nav aria-label="Menu portal" className="flex flex-col gap-2">
        <LinkRow href="#" title="Penjemput anak" detail="Siapa saja yang boleh menjemput" />
        <LinkRow href="#" title="Pesan WhatsApp" detail="Pilih yang ingin diterima" />
        <LinkRow href="#" title="Buku penghubung" detail="Pesan dengan wali kelas dan guru" />
      </nav>
      <SegmentedControl label="Rentang riwayat" value="30" onChange={() => undefined} options={[{ value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }, { value: '180', label: '180 hari' }]} />
      <Card as="section" aria-label="Kehadiran ADITYA PRATAMA" className="flex flex-col gap-3">
        <h2 className="m-0 text-h2">ADITYA PRATAMA · 4A</h2>
        <p className="m-0 flex flex-wrap items-center gap-2 text-body">
          Hari ini: <StatusChip code="H" />
          <span className="text-tinta-muted"> · tiba 06.52</span>
        </p>
        <CountsRow label="30 hari terakhir" counts={{ H: 19, T: 1, S: 1, I: 0, A: 0 }} />
        <ul aria-label="Riwayat" className="m-0 flex list-none flex-col gap-1 p-0">
          {DAYS.map(([d, c]) => (
            <li key={d} className="flex min-h-11 items-center justify-between gap-3 border-b border-garis py-1 last:border-b-0">
              <span>{d}</span>
              <StatusChip code={c} />
            </li>
          ))}
        </ul>
      </Card>
    </PageMain>
  ),
};
