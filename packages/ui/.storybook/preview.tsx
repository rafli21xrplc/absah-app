import type { Preview } from '@storybook/react-vite';
import '../src/storybook.css';

const preview: Preview = {
  // `manual` is a GLOBAL of addon-a11y (not a parameter): with it on, the addon's afterEach does not run axe after every story,
  // and the panel runs it when asked. Left off, that run collides with the Playwright spec (e2e/a11y.spec.ts, the CI gate)
  // with "Axe is already running", more often on a slow CI machine.
  initialGlobals: { a11y: { manual: true } },
  decorators: [
    // Components are shown the way a page holds them: one main landmark and one heading. Without this, axe reports
    // page-level problems that belong to the harness, not to the component.
    // A story that is a whole page and brings its own <main> (parameters.ownsMain) is shown as it is: it already has the landmark and its own h1.
    (Story, { title, parameters }) => {
      if (parameters['ownsMain']) return <Story />;
      return (
        <main>
          <h1 className="sr-only">{title}</h1>
          <Story />
        </main>
      );
    },
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    // The dark theme follows the OS (prefers-color-scheme), exactly like the apps; switch the OS or the browser's emulation to see it.
    a11y: { test: 'error' },
  },
};

export default preview;
