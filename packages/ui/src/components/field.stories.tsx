import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, Input, Select, Textarea } from './field';
import { Cell, Matrix } from './story-helpers';

const meta = { title: 'Primitif/Field', component: Field, args: { label: 'Nama', children: null } } satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { label: 'Nama wali', hint: 'Seperti di kartu keluarga' },
  render: ({ children: _children, ...args }) => <Field {...args}><Input defaultValue="" /></Field>,
};

/** Input, Textarea and Select each in default, focus, disabled and error. The Select error is not in the board: it follows the Input. */
export const StateMatrix: Story = {
  render: () => (
    <Matrix cols={2}>
      <Cell fill title="Input: bawaan"><Field label="Nama wali" hint="Seperti di kartu keluarga"><Input defaultValue="" /></Field></Cell>
      <Cell fill title="Input: fokus"><Field label="Nama wali"><Input className="pseudo-focus-visible-all" defaultValue="Siti" /></Field></Cell>
      <Cell fill title="Input: nonaktif"><Field label="Nama wali"><Input disabled defaultValue="Siti" /></Field></Cell>
      <Cell fill title="Input: galat"><Field label="Nomor WhatsApp" error="Nomor harus diawali 08 atau +62"><Input defaultValue="12" /></Field></Cell>
      <Cell fill title="Input: boleh dikosongkan"><Field label="Catatan" optional><Input /></Field></Cell>
      <Cell fill title="Textarea: galat"><Field label="Alasan" error="Alasan wajib diisi"><Textarea /></Field></Cell>
      <Cell fill title="Select: bawaan"><Field label="Rombel"><Select defaultValue=""><option value="" disabled>Pilih rombel</option><option>VII A</option><option>VII B</option></Select></Field></Cell>
      <Cell fill title="Select: galat"><Field label="Rombel" error="Pilih rombel dulu"><Select defaultValue=""><option value="" disabled>Pilih rombel</option><option>VII A</option></Select></Field></Cell>
      <Cell fill title="Select: nonaktif"><Field label="Rombel"><Select disabled><option>VII A</option></Select></Field></Cell>
    </Matrix>
  ),
  parameters: { pseudo: { focusVisible: ['.pseudo-focus-visible-all'] } },
};
