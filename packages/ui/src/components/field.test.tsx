// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Field, Input, Textarea } from './field';
import { Select } from './select';

describe('Field', () => {
  it('puts the label above the control and ties them together', () => {
    render(
      <Field label="Topik hari ini" optional>
        <Input placeholder="mis. Persamaan kuadrat" />
      </Field>,
    );
    const input = screen.getByLabelText(/Topik hari ini/);
    expect(input.tagName).toBe('INPUT');
    expect(screen.getByText('(boleh dikosongkan)')).toBeTruthy();
  });

  it('an error is written under the control in words and the control is marked invalid', () => {
    render(
      <Field label="Nomor WhatsApp orang tua" hint="Awali dengan 08." error="Nomor kurang panjang. Contoh: 0812-3456-7890.">
        <Input inputMode="tel" defaultValue="0812-3456" />
      </Field>,
    );
    const input = screen.getByLabelText('Nomor WhatsApp orang tua');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '');
    expect(described.join(' ')).toContain('Awali dengan 08.');
    expect(described.join(' ')).toContain('Nomor kurang panjang. Contoh: 0812-3456-7890.');
    expect(input.className).toContain('border-alpa');
  });

  it('without an error the control is not invalid', () => {
    render(
      <Field label="Nama">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Nama').getAttribute('aria-invalid')).toBeNull();
  });

  it('works with Textarea and Select, and typing reaches the control', async () => {
    render(
      <div>
        <Field label="Catatan">
          <Textarea />
        </Field>
        <Field label="Rombel">
          <Select defaultValue="x2">
            <option value="x1">X-1</option>
            <option value="x2">X-2</option>
          </Select>
        </Field>
      </div>,
    );
    await userEvent.type(screen.getByLabelText('Catatan'), 'Sakit perut');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Catatan').value).toBe('Sakit perut');
    await userEvent.selectOptions(screen.getByLabelText('Rombel'), 'x1');
    expect(screen.getByLabelText<HTMLSelectElement>('Rombel').value).toBe('x1');
  });

  it('a control outside a Field still works on its own', () => {
    render(<Input aria-label="Cari siswa" />);
    expect(screen.getByLabelText('Cari siswa')).toBeTruthy();
  });

  it('has no axe violations, with and without an error', async () => {
    const { container } = render(
      <div>
        <Field label="Nama">
          <Input />
        </Field>
        <Field label="Nomor" error="Nomor kurang panjang.">
          <Input />
        </Field>
        <Field label="Rombel">
          <Select>
            <option>X-1</option>
          </Select>
        </Field>
        <Field label="Catatan" hint="Boleh singkat.">
          <Textarea />
        </Field>
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
