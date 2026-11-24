import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { SkeletonRows } from './skeleton';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Keadaan/Empat keadaan', component: EmptyState, args: { title: 'Belum ada data' } } satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every list and form has these four before it counts as done (CLAUDE.md, Sistem-UI "Empat keadaan yang harus selalu ada"). */
export const EmpatKeadaan: Story = {
  render: () => (
    <Matrix cols={2}>
      <Cell fill title="kosong"><EmptyState title="Belum ada siswa di X-2" action={<Button>Impor dari Dapodik</Button>} headingLevel="h2">Tambahkan siswa satu per satu atau impor dari Dapodik.</EmptyState></Cell>
      <Cell fill title="memuat"><SkeletonRows count={3} /></Cell>
      <Cell fill title="galat"><ErrorState title="Presensi belum terkirim" onRetry={() => undefined}>Data aman di HP. Periksa sinyal, lalu coba lagi.</ErrorState></Cell>
      <Cell fill title="tanpa sinyal"><ErrorState kind="offline" title="Tersimpan di HP" pending={2}>2 presensi menunggu dikirim. Dikirim otomatis saat ada sinyal.</ErrorState></Cell>
    </Matrix>
  ),
};

export const Kosong: Story = { args: { title: 'Belum ada siswa di X-2', children: 'Tambahkan siswa satu per satu atau impor dari Dapodik.', action: <Button>Impor dari Dapodik</Button> } };
