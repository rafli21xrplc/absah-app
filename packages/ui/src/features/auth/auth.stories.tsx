import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { Field, Input } from '../../components/field';
import { useShake } from '../../components/motion/use-shake';
import { messages } from '../../../messages/id';
import { AuthShell } from './auth-shell';
import { BrandPanel } from './brand';
import { CodeInput } from './code-input';
import { PasswordField } from './password-field';
import { RoleTabs } from './role-tabs';

const meta = { title: 'Masuk/Bagian', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const t = messages.signIn;

export const Kerangka: Story = {
  name: 'Kerangka masuk',
  parameters: { ownsMain: true },
  render: () => (
    <AuthShell footer={messages.auth.footerNote}>
      <h1 className="m-0 text-h1 text-tinta">{t.title}</h1>
      <p className="m-0 text-body text-tinta-muted">{t.lead}</p>
    </AuthShell>
  ),
};

export const PanelMerek: Story = {
  name: 'Panel merek (layar lebar)',
  render: () => (
    <div className="flex min-h-dvh">
      <BrandPanel className="flex w-full" />
    </div>
  ),
};

function Tabs() {
  const [value, setValue] = useState<'staf' | 'ortu' | 'siswa'>('staf');
  return (
    <div className="max-w-md p-4">
      <RoleTabs
        label={t.roleLabel}
        value={value}
        onValueChange={setValue}
        tabs={[
          { key: 'staf', label: t.tabStaff },
          { key: 'ortu', label: t.tabParent },
          { key: 'siswa', label: t.tabStudent },
        ]}
      >
        <p className="m-0 text-body text-tinta">{value}</p>
      </RoleTabs>
    </div>
  );
}
export const Tab: Story = { name: 'Tiga jalur', render: () => <Tabs /> };

export const Kolom: Story = {
  name: 'Kolom email dan kata sandi',
  render: () => (
    <div className="flex max-w-md flex-col gap-4 p-4">
      <Field label={t.email} error={t.emailIncomplete}>
        <Input type="email" defaultValue="hendra@absah" />
      </Field>
      <PasswordField label={t.password} defaultValue="contoh-sandi-1" />
      <PasswordField label={t.password} error={t.passwordEmpty} />
    </div>
  ),
};

function Codes() {
  const [partial, setPartial] = useState('4817');
  const [wrong, setWrong] = useState(0);
  const shake = useShake(wrong);
  const [typed, setTyped] = useState('');
  return (
    <div className="flex max-w-md flex-col gap-6 p-4">
      <CodeInput label="Kode kosong" value="" onChange={() => undefined} />
      <CodeInput label="Kode sebagian" value={partial} onChange={setPartial} />
      <CodeInput label="Kode salah" value="481723" onChange={() => undefined} invalid aria-describedby="wrong" boxesClassName={shake} />
      <p id="wrong" className="m-0 text-small font-semibold text-alpa">
        {t.codeWrong}
      </p>
      <Button variant="secondary" onClick={() => setWrong((n) => n + 1)}>
        Salah lagi
      </Button>
      <CodeInput label="Kode diisi sendiri" value={typed} onChange={setTyped} />
      <CodeInput label="Kode nonaktif" value="48" onChange={() => undefined} disabled />
    </div>
  );
}
export const Kode: Story = { name: 'Kolom kode (satu input, enam kotak)', render: () => <Codes /> };

export const Banners: Story = {
  name: 'Banner masuk',
  render: () => (
    <div className="flex max-w-md flex-col gap-3 p-4">
      <Banner kind="error" title={t.invalidTitle}>
        {t.invalidBody} Sisa percobaan: 3 dari 5.
      </Banner>
      <Banner kind="error" title={t.lockedTitle}>
        Terlalu banyak percobaan. Coba lagi pukul 09.52.
      </Banner>
      <Banner kind="offline" title={t.offlineTitle}>
        {t.offlineBody}
      </Banner>
    </div>
  ),
};
