// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { ChildTabs, CountsRow, LinkRow, PortalStatusChip } from './portal-parts';

describe('ChildTabs', () => {
  it('is a named navigation of buttons; the child on screen is pressed', async () => {
    const onSelect = vi.fn();
    const { container } = render(<ChildTabs items={[{ key: 'a', label: 'ADITYA · 4A' }, { key: 'b', label: 'BUNGA · 2B' }]} selectedKey="a" onSelect={onSelect} />);
    const nav = screen.getByRole('navigation', { name: 'Pilih anak' });
    expect(within(nav).getByRole('button', { name: 'ADITYA · 4A' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(within(nav).getByRole('button', { name: 'BUNGA · 2B' }));
    expect(onSelect).toHaveBeenCalledWith('b');
    await expectNoAxeViolations(container);
  });
});

describe('PortalStatusChip and CountsRow', () => {
  it('writes the letter and the word, and says "belum tercatat" in words', async () => {
    const { container } = render(
      <div>
        <PortalStatusChip code="T" />
        <PortalStatusChip code={null} />
        <CountsRow label="30 hari terakhir" counts={{ H: 20, A: 1 }} />
      </div>,
    );
    expect(screen.getAllByText('Telat')).toHaveLength(2); // the chip and the count row
    expect(screen.getByText('Belum tercatat')).toBeTruthy();
    const counts = screen.getByRole('list', { name: '30 hari terakhir' });
    expect(within(counts).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['HHadir20', 'TTelat0', 'IIzin0', 'SSakit0', 'AAlpa1']);
    await expectNoAxeViolations(container);
  });
});

describe('LinkRow', () => {
  it('is one link named by its title and detail', async () => {
    const { container } = render(<LinkRow href="/portal/penjemput" title="Penjemput anak" detail="Siapa saja yang boleh menjemput" />);
    expect(screen.getByRole('link', { name: /Penjemput anak/ }).getAttribute('href')).toBe('/portal/penjemput');
    await expectNoAxeViolations(container);
  });
});
