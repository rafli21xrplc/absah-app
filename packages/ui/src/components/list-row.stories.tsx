import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListRow } from './list-row';
import { StatusPill } from './status-pill';

const meta = { title: 'Primitif/ListRow', component: ListRow, args: { name: 'Gilang Ramadhan' } } satisfies Meta<typeof ListRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { name: 'Gilang Ramadhan', detail: 'No. absen 10' } };

/** A class register as the teacher sees it: every right slot is its own StatusPill button. */
export const Presensi: Story = {
  render: () => (
    <ul className="m-0 flex max-w-md list-none flex-col gap-2 p-0">
      {([['Adinda Saraswati', 1, '?'], ['Ahmad Fauzan', 2, '?'], ['Bayu Firmansyah', 5, 'T'], ['Gilang Ramadhan', 10, 'H'], ['Putri Ayu Lestari', 20, 'A']] as const).map(([name, no, code]) => (
        <ListRow key={name} as="li" name={name} detail={`No. absen ${no}`} right={<StatusPill code={code} onPress={() => undefined} ariaLabel={`${name}: ${code === '?' ? 'Belum diisi' : code}. Ketuk untuk mengubah.`} />} />
      ))}
    </ul>
  ),
};

export const NamaPanjang: Story = { args: { name: 'Muhammad Abdurrahman Al-Fatih Pratama Wijayakusuma', detail: 'No. absen 12' }, decorators: [(S) => <div className="max-w-sm"><S /></div>] };
