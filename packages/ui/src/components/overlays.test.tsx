// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Button } from './button';
import { Dialog } from './dialog';
import { Drawer } from './drawer';
import { Sheet } from './sheet';

/** An opener button plus the overlay it opens, the way a page uses them: focus must come back to the button. */
function Opener({ children }: { children: (p: { open: boolean; setOpen: (o: boolean) => void }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <Button onClick={() => setOpen(true)}>Buka</Button>
      {children({ open, setOpen })}
    </main>
  );
}

const cases = [
  {
    name: 'Dialog',
    render: () => (
      <Opener>
        {({ open, setOpen }) => (
          <Dialog open={open} onOpenChange={setOpen} title="Keluarkan Gilang dari siswa aktif?" description="Data tidak dihapus." alert actions={<Button variant="danger">Keluarkan</Button>}>
            <p>isi</p>
          </Dialog>
        )}
      </Opener>
    ),
    cancel: 'Batal',
    role: 'alertdialog',
    title: 'Keluarkan Gilang dari siswa aktif?',
  },
  {
    name: 'Sheet',
    render: () => (
      <Opener>
        {({ open, setOpen }) => (
          <Sheet open={open} onOpenChange={setOpen} title="Gilang Ramadhan" eyebrow="Pilih kehadiran untuk">
            <p>pilihan</p>
          </Sheet>
        )}
      </Opener>
    ),
    cancel: 'Batal',
    role: 'dialog',
    title: 'Gilang Ramadhan',
  },
  {
    name: 'Drawer',
    render: () => (
      <Opener>
        {({ open, setOpen }) => (
          <Drawer open={open} onOpenChange={setOpen} title="Tambah siswa" actions={<Button type="submit">Simpan</Button>}>
            <p>isian</p>
          </Drawer>
        )}
      </Opener>
    ),
    cancel: 'Batal',
    role: 'dialog',
    title: 'Tambah siswa',
  },
] as const;

describe.each(cases)('$name (Radix Dialog)', ({ render: ui, cancel, role, title }) => {
  it('is named by its title and moves focus into itself', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    const dialog = await screen.findByRole(role, { name: title });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes with Esc and gives focus back to the button that opened it', async () => {
    render(ui());
    const opener = screen.getByRole('button', { name: 'Buka' });
    await userEvent.click(opener);
    await screen.findByRole(role);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
    // Radix puts focus back in a timeout after the dialog is gone.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('closes with the Batal button', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    await userEvent.click(await screen.findByRole('button', { name: cancel }));
    await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
  });

  it('closes when the scrim is pressed', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    await screen.findByRole(role);
    const scrim = document.querySelector('[data-state="open"].fixed.inset-0');
    expect(scrim).not.toBeNull();
    await userEvent.click(scrim as Element);
    await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
  });

  it('keeps Tab inside while it is open', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    const dialog = await screen.findByRole(role);
    for (let i = 0; i < 8; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('has no axe violations while open', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    const dialog = await screen.findByRole(role);
    await expectNoAxeViolations(dialog);
  });
});

describe('Dialog', () => {
  it('is an alertdialog only when asked, with the description read after the title', async () => {
    const { unmount } = render(<Dialog open onOpenChange={() => undefined} title="Plain" />);
    expect(await screen.findByRole('dialog', { name: 'Plain' })).toBeTruthy();
    unmount();
    render(<Dialog open onOpenChange={() => undefined} title="Keluarkan?" description="Data tidak dihapus." alert />);
    const alert = await screen.findByRole('alertdialog', { name: 'Keluarkan?' });
    const describedBy = alert.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe('Data tidak dihapus.');
  });

  it('puts Batal before the confirming action and runs the action', async () => {
    const onConfirm = vi.fn();
    render(<Dialog open onOpenChange={() => undefined} title="Keluarkan?" actions={<Button variant="danger" onClick={onConfirm}>Keluarkan</Button>} />);
    const buttons = (await screen.findAllByRole('button')).map((b) => b.textContent);
    expect(buttons).toEqual(['Batal', 'Keluarkan']);
    await userEvent.click(screen.getByRole('button', { name: 'Keluarkan' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('Sheet', () => {
  it('shows the eyebrow above the title and offers no drag handle control', async () => {
    render(<Sheet open onOpenChange={() => undefined} title="Gilang Ramadhan" eyebrow="Pilih kehadiran untuk"><p>x</p></Sheet>);
    await screen.findByRole('dialog', { name: 'Gilang Ramadhan' });
    expect(screen.getByText('Pilih kehadiran untuk')).toBeTruthy();
    // The bar on top is a picture: no button, slider or other control is named for it.
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Batal']);
  });
});

describe('Drawer', () => {
  it('sends the form from a submit button in the footer', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <Drawer open onOpenChange={() => undefined} title="Tambah siswa" onSubmit={onSubmit} actions={<Button type="submit">Simpan</Button>}>
        <label>
          Nama <input name="nama" defaultValue="Gilang" />
        </label>
      </Drawer>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Simpan' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('has a Tutup button in the header besides Batal', async () => {
    render(<Drawer open onOpenChange={() => undefined} title="Tambah siswa"><p>x</p></Drawer>);
    await screen.findByRole('dialog', { name: 'Tambah siswa' });
    expect(screen.getByRole('button', { name: 'Tutup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeTruthy();
  });
});
