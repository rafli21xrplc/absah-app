// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Button } from './button';

describe('Button', () => {
  it('is a type=button by default and carries its variant', () => {
    render(<Button variant="stabilo">Lihat 24 yang belum</Button>);
    const b = screen.getByRole('button', { name: 'Lihat 24 yang belum' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.dataset.variant).toBe('stabilo');
  });

  it.each([
    ['44', 'min-h-11'],
    ['48', 'min-h-12'],
    ['52', 'min-h-13'],
    ['64', 'min-h-16'],
  ] as const)('size %s uses the %s height class', (size, cls) => {
    render(<Button size={size}>Ok</Button>);
    expect(screen.getByRole('button').className).toContain(cls);
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Kirim presensi</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a disabled button with a reason says why in words, stays focusable and ignores presses', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled disabledReason="Pilih status untuk 3 siswa lagi." onClick={onClick}>
        Kirim presensi
      </Button>,
    );
    const b = screen.getByRole('button', { name: 'Kirim presensi' });
    expect(screen.getByText('Pilih status untuk 3 siswa lagi.')).toBeTruthy();
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.hasAttribute('disabled')).toBe(false);
    expect(b.getAttribute('aria-describedby')).toBe(screen.getByText('Pilih status untuk 3 siswa lagi.').id);
    b.focus();
    expect(document.activeElement).toBe(b);
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('a disabled button without a reason is natively disabled', () => {
    render(<Button disabled>Kirim</Button>);
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });

  it('loading shows it in words for screen readers and ignores presses', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Kirim presensi
      </Button>,
    );
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.textContent).toContain('Sedang diproses');
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a caller aria-describedby next to the reason', () => {
    render(
      <Button disabled disabledReason="Belum bisa." aria-describedby="catatan">
        Kirim
      </Button>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')?.split(' ')).toContain('catatan');
  });

  it('has no axe violations in any state', async () => {
    const { container } = render(
      <div>
        <Button>Utama</Button>
        <Button variant="secondary">Sekunder</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Keluarkan siswa</Button>
        <Button disabled disabledReason="Alasannya.">
          Nonaktif
        </Button>
        <Button loading>Memuat</Button>
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
