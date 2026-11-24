// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Toast, ToastProvider } from './toast';

function Harness({ onUndo, duration }: { onUndo?: () => void; duration?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider duration={duration}>
      <main>
        <span data-testid="state">{open ? 'open' : 'closed'}</span>
      </main>
      <Toast open={open} onOpenChange={setOpen} message="24 siswa ditandai Hadir." onUndo={onUndo} />
    </ToastProvider>
  );
}

describe('Toast', () => {
  it('is announced politely through a status live region and says what happened', async () => {
    render(<Harness onUndo={() => undefined} />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('24 siswa ditandai Hadir.'));
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('Urungkan is at least 44 px high, runs the undo and closes the toast', async () => {
    const onUndo = vi.fn();
    render(<Harness onUndo={onUndo} />);
    const undo = screen.getByRole('button', { name: 'Urungkan' });
    expect(undo.className).toContain('min-h-11');
    await userEvent.click(undo);
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByTestId('state').textContent).toBe('closed');
  });

  it('has no Urungkan when nothing was changed in bulk', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Urungkan' })).toBeNull();
  });

  it('can always be closed by hand (Tutup, 44 px)', async () => {
    render(<Harness />);
    const close = screen.getByRole('button', { name: 'Tutup' });
    expect(close.className).toContain('size-11');
    await userEvent.click(close);
    expect(screen.getByTestId('state').textContent).toBe('closed');
  });

  it('closes by itself after the duration', async () => {
    vi.useFakeTimers();
    render(<Harness duration={1000} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(screen.getByTestId('state').textContent).toBe('closed');
    vi.useRealTimers();
  });

  it('the countdown stops while the toast is hovered', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness duration={1000} />);
    const toast = screen.getByText('24 siswa ditandai Hadir.').closest('li') as HTMLElement;
    await act(async () => {
      toast.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId('state').textContent).toBe('open');
    vi.useRealTimers();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness onUndo={() => undefined} />);
    await expectNoAxeViolations(document.body);
    expect(container).toBeTruthy();
  });
});
