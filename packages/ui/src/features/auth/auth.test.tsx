// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { AuthShell } from './auth-shell';
import { CodeInput } from './code-input';
import { PasswordField } from './password-field';
import { RoleTabs } from './role-tabs';

function Code({ onComplete }: { onComplete: (v: string) => void }) {
  const [value, setValue] = useState('');
  return <CodeInput label="Kode dari WhatsApp" value={value} onChange={setValue} onComplete={onComplete} />;
}

describe('CodeInput', () => {
  it('is one input with a name, one-time-code autofill and a numeric keypad', () => {
    render(<Code onComplete={() => undefined} />);
    const input = screen.getByRole('textbox', { name: 'Kode dari WhatsApp' });
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('maxlength')).toBe('6');
  });

  it('keeps digits only, shows them in the boxes, and sends itself once on the sixth', async () => {
    const onComplete = vi.fn();
    const { container } = render(<Code onComplete={onComplete} />);
    const input = screen.getByRole('textbox', { name: 'Kode dari WhatsApp' });
    await userEvent.type(input, '48a1 7');
    expect((input as HTMLInputElement).value).toBe('4817');
    expect(container.querySelector('[aria-hidden]')?.textContent).toBe('4817');
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.type(input, '23');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('481723');
  });

  it('takes a pasted code with spaces', async () => {
    const onComplete = vi.fn();
    render(<Code onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('481 723');
    expect(onComplete).toHaveBeenCalledWith('481723');
  });

  it('passes axe', async () => {
    const { container } = render(<Code onComplete={() => undefined} />);
    await expectNoAxeViolations(container);
  });
});

describe('PasswordField', () => {
  it('hides the password until asked, and the button says what it does', async () => {
    render(<PasswordField label="Kata sandi" defaultValue="rahasia-123" autoComplete="current-password" />);
    const input = screen.getByLabelText<HTMLInputElement>('Kata sandi');
    expect(input.getAttribute('type')).toBe('password');
    const button = screen.getByRole('button', { name: 'Tampilkan kata sandi' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(button);
    expect(input.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Sembunyikan kata sandi' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('does not block pasting', async () => {
    render(<PasswordField label="Kata sandi" />);
    await userEvent.click(screen.getByLabelText('Kata sandi'));
    await userEvent.paste('tempel-dari-pengelola');
    expect(screen.getByLabelText<HTMLInputElement>('Kata sandi').value).toBe('tempel-dari-pengelola');
  });

  it('writes the problem under the box, tied to it', () => {
    render(<PasswordField label="Kata sandi" error="Isi kata sandi Anda." />);
    const input = screen.getByLabelText('Kata sandi');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Isi kata sandi Anda.')).toBeTruthy();
  });
});

describe('RoleTabs and AuthShell', () => {
  it('is a tablist with the chosen tab selected, and changes with the keyboard', async () => {
    const onValueChange = vi.fn();
    render(
      <RoleTabs label="Saya adalah" value="a" onValueChange={onValueChange} tabs={[{ key: 'a', label: 'Guru dan staf' }, { key: 'b', label: 'Orang tua' }]}>
        <p>isi</p>
      </RoleTabs>,
    );
    expect(screen.getByRole('tablist', { name: 'Saya adalah' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Guru dan staf' }).getAttribute('aria-selected')).toBe('true');
    await userEvent.click(screen.getByRole('tab', { name: 'Orang tua' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('has the form as its main landmark, names what Absah connects, and passes axe', async () => {
    const { container } = render(
      <AuthShell>
        <h1>Masuk ke Absah</h1>
      </AuthShell>,
    );
    expect(screen.getByRole('main')).toBeTruthy();
    const parts = screen.getByRole('list', { name: 'Yang terhubung di Absah' });
    expect(parts.querySelectorAll('li')).toHaveLength(8);
    expect(parts.textContent).toContain('Kios gerbang');
    expect(screen.queryByRole('button', { name: 'Jeda animasi' })).toBeNull();
    await expectNoAxeViolations(container);
  });
});
