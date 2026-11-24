// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { X } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('is named by its label, and the icon is hidden from screen readers', async () => {
    const onClick = vi.fn();
    const { container } = render(<IconButton label="Tutup" icon={<X className="size-5" />} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tutup' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it.each([
    ['44', 'size-11'],
    ['52', 'size-13'],
    ['64', 'size-16'],
  ] as const)('size %s is %s', (size, cls) => {
    render(<IconButton label="Ok" size={size} icon={<X />} />);
    expect(screen.getByRole('button').className).toContain(cls);
  });
});
