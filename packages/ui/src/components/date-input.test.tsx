// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { DateInput, DateRangeInput } from './date-input';
import { Field } from './field';

let wide = true;
// The calendar is a lazy chunk (react-day-picker, date-fns locale); load it once up front so no test waits on the import.
beforeAll(async () => {
  await import('./date-popover');
}, 30_000);
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  wide = true;
});

function Controlled({ initial, type = 'date' as const, onValue }: { initial: string; type?: 'date' | 'month' | 'time'; onValue: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Field label="Tanggal kejadian">
      <DateInput
        type={type}
        name="tanggal"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          onValue(e.target.value);
        }}
      />
    </Field>
  );
}

describe('DateInput', () => {
  it('is the browser input on a phone', () => {
    wide = false;
    render(<Controlled initial="2026-11-27" onValue={() => undefined} />);
    const box = screen.getByLabelText('Tanggal kejadian');
    expect(box.tagName).toBe('INPUT');
    expect(box.getAttribute('type')).toBe('date');
  });

  it('opens a calendar on a laptop and gives the page a real change event with the ISO date', async () => {
    const onValue = vi.fn();
    const { container } = render(<Controlled initial="2026-11-27" onValue={onValue} />);
    const trigger = await screen.findByRole('button', { name: /^Tanggal kejadian/ }, { timeout: 5000 });
    expect(trigger.textContent).toContain('Jum, 27 Nov 2026');
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /(^|\s)3 November 2026/ }));
    expect(onValue).toHaveBeenCalledWith('2026-11-03');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="tanggal"]')?.value).toBe('2026-11-03');
    expect(trigger.textContent).toContain('Sel, 3 Nov 2026');
  });

  it('picks a month from a grid', async () => {
    const onValue = vi.fn();
    render(<Controlled type="month" initial="2026-11" onValue={onValue} />);
    const trigger = await screen.findByRole('button', { name: /^Tanggal kejadian/ }, { timeout: 5000 });
    expect(trigger.textContent).toContain('November 2026');
    await userEvent.click(trigger);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Feb' }));
    expect(onValue).toHaveBeenCalledWith('2026-02');
  });

  it('picks a time from hour and minute lists', async () => {
    const onValue = vi.fn();
    render(<Controlled type="time" initial="07:00" onValue={onValue} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Tanggal kejadian/ }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(within(dialog).getByRole('group', { name: 'Jam' })).getByRole('button', { name: '09' }));
    expect(onValue).toHaveBeenLastCalledWith('09:00');
    await userEvent.click(within(within(dialog).getByRole('group', { name: 'Menit' })).getByRole('button', { name: '15' }));
    expect(onValue).toHaveBeenLastCalledWith('09:15');
  });

  it('has no axe violations, closed and open', async () => {
    const { container } = render(<Controlled initial="2026-11-27" onValue={() => undefined} />);
    await expectNoAxeViolations(container);
    await userEvent.click(await screen.findByRole('button', { name: /^Tanggal kejadian/ }, { timeout: 5000 }));
    await expectNoAxeViolations(await screen.findByRole('dialog'));
  });
});

describe('DateRangeInput', () => {
  it('takes the start, then the end, and reports both once', async () => {
    const onChange = vi.fn();
    render(<DateRangeInput aria-label="Tanggal izin" from="2026-11-27" to="2026-11-27" onChange={onChange} />);
    const trigger = await screen.findByRole('button', { name: /^Tanggal izin/ }, { timeout: 5000 });
    expect(trigger.textContent).toContain('Jum, 27 Nov 2026');
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getAllByRole('button', { name: /(^|\s)2 November 2026/ })[0]!);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getAllByRole('button', { name: /(^|\s)6 November 2026/ })[0]!);
    expect(onChange).toHaveBeenCalledWith('2026-11-02', '2026-11-06');
  });

  it('is two browser inputs on a phone', () => {
    wide = false;
    render(<DateRangeInput aria-label="Tanggal izin" from="2026-11-02" to="2026-11-06" onChange={() => undefined} />);
    expect(screen.getByLabelText<HTMLInputElement>('Dari').value).toBe('2026-11-02');
    expect(screen.getByLabelText<HTMLInputElement>('Sampai').value).toBe('2026-11-06');
  });
});
