import { cva } from 'class-variance-authority';

/** The class names of a button. Pure (no React), so a server component or a plain link can use it too. */
export const buttonStyles = cva(
  'box-border inline-flex select-none items-center justify-center gap-2 rounded-kontrol px-4 text-isi-strong font-bold transition-colors duration-(--motion-cepat)',
  {
    variants: {
      variant: { primary: '', stabilo: '', secondary: '', soft: '', outline: '', ghost: '', danger: '' },
      // From 1024 px (mouse) every size is one step thinner; phones keep the 44 px tap target.
      size: { '36': 'min-h-9 px-3 lg:min-h-8', '40': 'min-h-10 px-4 lg:min-h-9 lg:px-3', '44': 'min-h-11 lg:min-h-10', '48': 'min-h-12 lg:min-h-10', '52': 'min-h-13 px-5 lg:min-h-11', '64': 'min-h-16 px-6' },
      blocked: { true: 'cursor-not-allowed border border-transparent bg-garis text-tinta-muted', false: 'cursor-pointer' },
      // Working is not the same as unavailable (Motion-UI 2): the button keeps its colour, shows the ring and ignores presses.
      busy: { true: '!cursor-progress', false: '' },
    },
    // Colours live here, not in `variant`, so a blocked button replaces them instead of fighting them.
    compoundVariants: [
      {
        variant: 'primary',
        blocked: false,
        // papan-deep keeps the label readable in both themes since tokens v3 (checked in tokens.test.ts).
        class: 'border border-transparent bg-papan text-on-papan shadow-aksi hover:bg-papan-deep active:bg-papan-deep',
      },
      { variant: 'stabilo', blocked: false, class: 'border border-transparent bg-stabilo text-on-stabilo hover:brightness-95 active:brightness-90' },
      {
        variant: 'secondary',
        blocked: false,
        class: 'border border-garis-kuat bg-kapur-raised font-semibold text-tinta hover:bg-papan-soft active:bg-papan-soft',
      },
      // v3: soft = papan-soft fill (secondary action inside a card); outline = labelled button with the soft border. Input fields keep garis-kuat.
      { variant: 'soft', blocked: false, class: 'border border-transparent bg-papan-soft text-papan hover:bg-papan-tipis active:bg-papan-tipis' },
      { variant: 'outline', blocked: false, class: 'border border-batas-lembut bg-kapur-raised font-semibold text-tinta hover:bg-ubin active:bg-ubin' },
      { variant: 'ghost', blocked: false, class: 'border border-transparent bg-transparent text-papan hover:bg-papan-soft active:bg-papan-soft' },
      { variant: 'danger', blocked: false, class: 'border border-alpa bg-kapur-raised text-alpa hover:bg-alpa-soft active:bg-alpa-soft' },
    ],
    defaultVariants: { variant: 'primary', size: '44', blocked: false, busy: false },
  },
);
