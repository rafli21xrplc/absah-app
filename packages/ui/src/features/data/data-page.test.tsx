// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { DataHeader } from './data-page';
import { ExitDialog } from './exit-dialog';

describe('DataHeader', () => {
  it('names the page, says one line about it and lists only the actions it was given', async () => {
    const { container } = render(
      <main>
        <DataHeader title="Siswa" subtitle="36 rombel" actions={<a href="#i">Import dari Dapodik</a>} />
      </main>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Siswa' })).toBeTruthy();
    expect(screen.getByText('36 rombel')).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});

describe('ExitDialog', () => {
  const reasons = [
    { value: 'moved', label: 'Pindah sekolah' },
    { value: 'left', label: 'Keluar' },
  ] as const;
  const open = (onConfirm = vi.fn(), error?: string) =>
    render(<ExitDialog open onOpenChange={() => undefined} title="Keluarkan Bunga dari siswa aktif?" description="Data tidak dihapus." reasonLabel="Alasan" reasons={reasons} confirmLabel="Keluarkan" error={error} onConfirm={onConfirm} />);

  it('is an alert dialog; nothing is chosen and the button is off until a reason is picked', async () => {
    const onConfirm = vi.fn();
    open(onConfirm);
    expect(screen.getByRole('alertdialog', { name: 'Keluarkan Bunga dari siswa aktif?' })).toBeTruthy();
    expect(screen.getAllByRole<HTMLInputElement>('radio').some((r) => r.checked)).toBe(false);
    const confirm = screen.getByRole<HTMLButtonElement>('button', { name: 'Keluarkan' });
    expect(confirm.disabled).toBe(true);
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'Keluar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keluarkan' }));
    expect(onConfirm).toHaveBeenCalledWith('left');
  });

  it('shows what went wrong under the reasons', () => {
    open(vi.fn(), 'Siswa sudah tidak aktif.');
    expect(screen.getByRole('alert').textContent).toBe('Siswa sudah tidak aktif.');
  });
});
