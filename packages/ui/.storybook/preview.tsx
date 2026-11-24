import type { Preview } from '@storybook/react-vite';
import '../src/storybook.css';

const preview: Preview = {
  decorators: [
    // Components are shown the way a page holds them: one main landmark and one heading. Without this, axe reports
    // page-level problems that belong to the harness, not to the component.
    (Story, { title }) => (
      <main>
        <h1 className="sr-only">{title}</h1>
        <Story />
      </main>
    ),
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    // The dark theme follows the OS (prefers-color-scheme), exactly like the apps; switch the OS or the browser's emulation to see it.
    // The panel runs axe when asked (manual). If it ran on every render it would collide with the Playwright spec
    // (e2e/a11y.spec.ts), which is the gate in CI ("Axe is already running").
    a11y: { test: 'error', manual: true },
  },
};

export default preview;
