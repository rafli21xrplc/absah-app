// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Field } from './field';
import { Select } from './select';

function widescreen(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

/** The popover chunk loads after mount; until then the native <select> (also a combobox) stands in. */
async function popoverTrigger(name: string) {
  await waitFor(() => expect(screen.getByRole('combobox', { name }).tagName).toBe('BUTTON'));
  return screen.getByRole('combobox', { name });
}

function Rombel({ many = false }: { many?: boolean }) {
  const [value, setValue] = useState('b');
  return (
    <Field label="Rombel">
      <Select value={value} onChange={(e) => setValue(e.target.value)} name="rombel">
        <option value="a">VII A</option>
        <option value="b">VII B</option>
        <option value="c" disabled>
          VII C (penuh)
        </option>
        {many && Array.from({ length: 10 }, (_, i) => <option key={i} value={`x${i}`}>{`Kelas X-${i + 1}`}</option>)}
      </Select>
    </Field>
  );
}

describe('Select', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView = () => undefined;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('on a phone it is the browser\'s own select', () => {
    widescreen(false);
    render(<Rombel />);
    expect(screen.getByLabelText('Rombel').tagName).toBe('SELECT');
  });

  it('on a laptop it opens a popover with the choices, the current one marked', async () => {
    widescreen(true);
    render(<Rombel />);
    const trigger = await popoverTrigger('Rombel');
    expect(trigger.textContent).toContain('VII B');
    await userEvent.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['VII A', 'VII B', 'VII C (penuh)']);
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(screen.getByPlaceholderText('Cari').closest('.sr-only')).not.toBeNull();
  });

  it('choosing fires the real onChange with a <select> target, closes the popover and shows the choice', async () => {
    widescreen(true);
    render(<Rombel />);
    await userEvent.click(await popoverTrigger('Rombel'));
    await userEvent.click(screen.getByRole('option', { name: 'VII A' }));
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Rombel' }).textContent).toContain('VII A');
    expect(document.querySelector<HTMLSelectElement>('select[name="rombel"]')?.value).toBe('a');
  });

  it('a disabled choice cannot be picked', async () => {
    widescreen(true);
    render(<Rombel />);
    await userEvent.click(await popoverTrigger('Rombel'));
    await userEvent.click(screen.getByRole('option', { name: 'VII C (penuh)' }));
    expect(screen.getByRole('combobox', { name: 'Rombel' }).textContent).toContain('VII B');
  });

  it('a long list gets a search box that narrows the choices', async () => {
    widescreen(true);
    render(<Rombel many />);
    await userEvent.click(await popoverTrigger('Rombel'));
    await userEvent.type(screen.getByPlaceholderText('Cari'), 'X-7');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Kelas X-7']);
    await userEvent.clear(screen.getByPlaceholderText('Cari'));
    await userEvent.type(screen.getByPlaceholderText('Cari'), 'zzz');
    expect(screen.getByText('Tidak ditemukan.')).toBeTruthy();
  });

  it('works uncontrolled with defaultValue', async () => {
    widescreen(true);
    render(
      <Field label="Zona waktu">
        <Select defaultValue="Asia/Makassar">
          <option value="Asia/Jakarta">WIB</option>
          <option value="Asia/Makassar">WITA</option>
        </Select>
      </Field>,
    );
    expect((await popoverTrigger('Zona waktu')).textContent).toContain('WITA');
    await userEvent.click(screen.getByRole('combobox', { name: 'Zona waktu' }));
    await userEvent.click(screen.getByRole('option', { name: 'WIB' }));
    expect(screen.getByRole('combobox', { name: 'Zona waktu' }).textContent).toContain('WIB');
  });

  it('options it cannot read (a component that renders them) fall back to the native select', () => {
    widescreen(true);
    const Options = () => <option>VII A</option>;
    render(
      <Field label="Rombel">
        <Select>
          <Options />
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText('Rombel').tagName).toBe('SELECT');
  });

  it('has no accessibility violations open or closed', async () => {
    widescreen(true);
    const { container } = render(
      <main>
        <Rombel many />
      </main>,
    );
    await popoverTrigger('Rombel');
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('combobox', { name: 'Rombel' }));
    await expectNoAxeViolations(document.body);
  });
});
