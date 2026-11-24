// Shared ESLint flat config for Absah TypeScript packages (non-Next). apps/web and apps/kiosk
// extend eslint-config-next on top of the same rules.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.RulesRecord} */
export const absahRules = {
  // CLAUDE.md rule 7: no any, no ts-ignore.
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' }],
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
};

// U1: colours come from design/ds/absah/tokens.json, never as literals in apps. Use a Tailwind class, a CSS variable,
// or `color` from '@absah/ui/tokens' (manifest and viewport need a real value). Anchored so "#fragment" links pass.
const HEX = String.raw`(?:^|[\s,(:])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])`;
export const noHexColors = {
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: `Literal[value=/${HEX}/]`, message: 'No hex colour literals in apps. Use a token class, a CSS variable or `color` from @absah/ui/tokens.' },
      { selector: `TemplateElement[value.raw=/${HEX}/]`, message: 'No hex colour literals in apps. Use a token class, a CSS variable or `color` from @absah/ui/tokens.' },
    ],
  },
};

export const ignores = ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/.next/**', '**/out/**', '**/coverage/**', '**/next-env.d.ts'];

export default tseslint.config(
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser }, parserOptions: { projectService: true } },
    rules: absahRules,
  },
  { files: ['**/*.js', '**/*.cjs', '**/*.mjs'], ...tseslint.configs.disableTypeChecked },
);
