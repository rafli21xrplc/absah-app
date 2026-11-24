import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  stories: ['../src/**/*.stories.tsx'],
  // a11y shows axe results in the panel; pseudo-states lets a story show hover and focus at once.
  addons: ['@storybook/addon-a11y', 'storybook-addon-pseudo-states'],
  viteFinal: (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
