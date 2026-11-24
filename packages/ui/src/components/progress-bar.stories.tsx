import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './progress-bar';

const meta = { title: 'Primitif/ProgressBar', component: ProgressBar, args: { value: 0, max: 1, label: 'Kemajuan' } } satisfies Meta<typeof ProgressBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { value: 12, max: 25, unit: 'siswa', label: 'Sudah diisi' } };

export const Steps: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <ProgressBar value={0} max={25} unit="siswa" label="Sudah diisi" />
      <ProgressBar value={12} max={25} unit="siswa" label="Sudah diisi" />
      <ProgressBar value={25} max={25} unit="siswa" label="Sudah diisi" />
      <ProgressBar value={30} max={25} unit="siswa" label="Lebih dari jumlah (dibatasi)" />
    </div>
  ),
};
