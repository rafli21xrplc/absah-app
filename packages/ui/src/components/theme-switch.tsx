'use client';

import { messages } from '../../messages/id';
import { useTheme, type ThemePreference } from '../theme';
import { SegmentedControl } from './segmented-control';

const t = messages.theme;

/** Sistem, Terang or Gelap. The choice applies at once and stays on this device (see theme.ts). */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  const options: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t.system },
    { value: 'light', label: t.light },
    { value: 'dark', label: t.dark },
  ];
  return <SegmentedControl label={t.label} options={options} value={theme} onChange={setTheme} />;
}
