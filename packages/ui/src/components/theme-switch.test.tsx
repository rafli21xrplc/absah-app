// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_KEY } from '../theme-script';
import { ThemeSwitch } from './theme-switch';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeSwitch', () => {
  it('starts on Sistem and switches the page theme on tap', async () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole('button', { name: 'Sistem' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Gelap' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Gelap' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Terang' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
