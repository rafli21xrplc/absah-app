import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, cx } from './index';

describe('Button', () => {
  it('renders a type=button by default so it never submits forms by accident', () => {
    const html = renderToStaticMarkup(<Button>Simpan</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('data-variant="primary"');
    expect(html).toContain('Simpan');
  });
});

describe('cx', () => {
  it('skips falsy parts', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
});
