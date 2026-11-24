// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { ChoiceGroup, PresetSummary, Stepper } from './setup-parts';

const STEPS = [
  { id: 'profile', label: 'Profil', status: 'done' },
  { id: 'level', label: 'Jenjang', status: 'todo' },
  { id: 'import', label: 'Data siswa', status: 'skipped' },
] as const;

describe('Stepper', () => {
  it('marks the step on screen, writes skipped steps in words for a screen reader', async () => {
    const { container } = render(<Stepper items={STEPS} current={1} label="Langkah setup" skippedText="dilewati" />);
    const list = screen.getByRole('list', { name: 'Langkah setup' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(items[2]?.textContent).toContain('dilewati');
    await expectNoAxeViolations(container);
  });
});

describe('ChoiceGroup', () => {
  it('is a fieldset of radios named by their label; the hint describes, it does not rename', async () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ChoiceGroup legend="Jenjang" name="level" value="sd" onValueChange={onValueChange} options={[{ value: 'sd', label: 'SD/MI', hint: 'Presensi harian' }, { value: 'smk', label: 'SMK/MAK' }]} />,
    );
    const group = screen.getByRole('group', { name: 'Jenjang' });
    expect(within(group).getByRole('radio', { name: 'SD/MI' })).toHaveProperty('checked', true);
    expect(within(group).getByRole('radio', { name: 'SD/MI' }).getAttribute('aria-describedby')).toBeTruthy();
    await userEvent.click(within(group).getByRole('radio', { name: 'SMK/MAK' }));
    expect(onValueChange).toHaveBeenCalledWith('smk');
    await expectNoAxeViolations(container);
  });

  it('works uncontrolled inside a form, with the default answer chosen', () => {
    render(
      <form aria-label="f">
        <ChoiceGroup legend="MBG" name="mbg" required defaultValue="tidak" options={[{ value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak' }]} />
      </form>,
    );
    expect(new FormData(screen.getByRole<HTMLFormElement>('form', { name: 'f' })).get('mbg')).toBe('tidak');
  });
});

describe('PresetSummary', () => {
  it('lists what is switched on', async () => {
    const { container } = render(<PresetSummary title="Yang aktif untuk SD/MI:" items={['Penjemputan', 'Kartu orang tua']} testId="preset-summary" />);
    expect(within(screen.getByTestId('preset-summary')).getAllByRole('listitem')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });
});
