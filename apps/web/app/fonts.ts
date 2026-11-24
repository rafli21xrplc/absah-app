import localFont from 'next/font/local';

/** Plus Jakarta Sans, latin subset, one variable file (OFL, packages/ui/fonts). Local so it works offline. */
export const plusJakarta = localFont({
  src: '../../../packages/ui/fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  variable: '--font-plus-jakarta',
  weight: '200 800',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});
