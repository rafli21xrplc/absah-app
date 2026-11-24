import { cva } from 'class-variance-authority';

/** The class names of a button. Pure (no React), so a server component or a plain link can use it too. */
export const buttonStyles = cva(
  'box-border inline-flex select-none items-center justify-center gap-2 rounded-md px-5 text-body-strong font-bold transition-colors duration-150',
  {
    variants: {
      variant: { primary: '', stabilo: '', secondary: '', ghost: '', danger: '' },
      size: { '44': 'min-h-11', '48': 'min-h-12', '52': 'min-h-13', '64': 'min-h-16 px-6' },
      blocked: { true: 'cursor-not-allowed border border-transparent bg-garis text-tinta-muted', false: 'cursor-pointer' },
    },
    // Colours live here, not in `variant`, so a blocked button replaces them instead of fighting them.
    compoundVariants: [
      {
        variant: 'primary',
        blocked: false,
        // In the dark theme papan-deep is too dark under the dark label (3.46:1, see tokens.test.ts), so the pressed
        // state keeps papan and dims it instead. Pending a design decision (PR #63).
        class:
          'border border-transparent bg-papan text-on-papan hover:bg-papan-deep active:bg-papan-deep dark:hover:bg-papan dark:active:bg-papan dark:hover:brightness-90 dark:active:brightness-90',
      },
      { variant: 'stabilo', blocked: false, class: 'border border-transparent bg-stabilo text-on-stabilo hover:brightness-95 active:brightness-90' },
      {
        variant: 'secondary',
        blocked: false,
        class: 'border border-garis-kuat bg-kapur-raised font-semibold text-tinta hover:bg-papan-soft active:bg-papan-soft',
      },
      { variant: 'ghost', blocked: false, class: 'border border-transparent bg-transparent text-papan hover:bg-papan-soft active:bg-papan-soft' },
      { variant: 'danger', blocked: false, class: 'border border-alpa bg-kapur-raised text-alpa hover:bg-alpa-soft active:bg-alpa-soft' },
    ],
    defaultVariants: { variant: 'primary', size: '44', blocked: false },
  },
);
