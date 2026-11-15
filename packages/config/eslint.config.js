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
