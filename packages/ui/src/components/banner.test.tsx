// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Banner } from './banner';

describe('Banner', () => {
  it('uses the kind\'s own word as the bold lead-in', () => {
    render(<Banner kind="offline">Data aman di HP dan dikirim otomatis.</Banner>);
    expect(screen.getByText('Tanpa sinyal.').tagName).toBe('B');
    expect(screen.getByRole('status').textContent).toContain('Data aman di HP dan dikirim otomatis.');
  });

  it('an error is announced at once (role alert), the others politely (role status)', () => {
    render(
      <div>
        <Banner kind="error">Coba lagi. Presensi Anda tidak hilang.</Banner>
        <Banner kind="info">Satu kalimat.</Banner>
        <Banner kind="warning">Hati-hati.</Banner>
      </div>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('a custom title replaces the default and an action is shown', () => {
    render(
      <Banner kind="error" title="Belum terkirim" action={<button type="button">Coba lagi</button>}>
        Presensi X-2 tersimpan di HP.
      </Banner>,
    );
    expect(screen.getByText('Belum terkirim.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeTruthy();
  });

  it('the icon is decorative: the title carries the meaning', () => {
    const { container } = render(<Banner>Info.</Banner>);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no axe violations for any kind', async () => {
    const { container } = render(
      <div>
        {(['info', 'warning', 'offline', 'error'] as const).map((k) => (
          <Banner key={k} kind={k}>
            Satu kalimat.
          </Banner>
        ))}
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
