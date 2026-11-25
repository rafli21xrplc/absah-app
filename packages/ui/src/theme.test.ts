// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, parseTheme, readTheme, saveTheme } from './theme';
import { THEME_INIT_SCRIPT, THEME_KEY } from './theme-script';

/** Runs the inline head script the way the browser does: as a <script> in the document. */
function runInitScript() {
  const el = document.createElement('script');
  el.textContent = THEME_INIT_SCRIPT;
  document.head.append(el);
  el.remove();
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme preference', () => {
  it('reads only light and dark; anything else follows the system', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('sepia')).toBe('system');
    expect(parseTheme(null)).toBe('system');
  });

  it('saves a choice, sets data-theme and tells listeners', () => {
    let heard = 0;
    window.addEventListener('absah-tema-berubah', () => heard++);
    saveTheme('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(readTheme()).toBe('dark');
    expect(heard).toBe(1);
  });

  it('"system" forgets the choice and hands the page back to the OS', () => {
    saveTheme('light');
    saveTheme('system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('the inline head script applies a saved choice exactly like applyTheme', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    runInitScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('system');
    localStorage.setItem(THEME_KEY, 'junk');
    runInitScript();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
