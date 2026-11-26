import type { ElementType, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { STATUS_LOOK } from '../../components/status-pill';
import { cx } from '../../cx';
import { statusTokens, type StatusCode } from '../../status';

export interface ChildTab {
  key: string;
  label: string;
}

/**
 * "Pilih anak": one button per child at the top of every portal page. Pressed = the child on screen. The parent decides when to
 * show it (one child needs no picker). Buttons, not tabs: the page below does not have a panel per child.
 */
export function ChildTabs({ items, selectedKey, onSelect, children }: { items: readonly ChildTab[]; selectedKey: string | null; onSelect: (key: string) => void; children?: ReactNode }) {
  return (
    <nav aria-label="Pilih anak" className="flex flex-wrap gap-2">
      {items.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={c.key === selectedKey}
          onClick={() => onSelect(c.key)}
          className={cx(
            'min-h-11 cursor-pointer rounded-md border px-4 text-small font-bold text-tinta',
            c.key === selectedKey ? 'border-2 border-papan bg-kapur-raised' : 'border-garis-kuat bg-kapur-raised',
          )}
        >
          {c.label}
        </button>
      ))}
      {children}
    </nav>
  );
}

const CHIP = 'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-small font-bold';

/** A small status for a list of days: letter, word and colour. `null` = nothing recorded, said in words. */
export function PortalStatusChip({ code, empty = 'Belum tercatat' }: { code: StatusCode | null; empty?: string }) {
  if (!code) return <span className={cx(CHIP, 'border-[1.5px] border-dashed border-garis-kuat bg-kapur-raised text-tinta-muted')}>{empty}</span>;
  const { huruf, kata } = statusTokens(code);
  return (
    <span className={cx(CHIP, STATUS_LOOK[code].pill)}>
      <span aria-hidden className={cx('inline-flex size-5 items-center justify-center rounded-sm text-[0.75rem]', STATUS_LOOK[code].chip)}>
        {huruf}
      </span>
      {kata}
    </span>
  );
}

/** The counts of the chosen range in the fixed order H T I S A: letter, word, number. */
export function CountsRow({ counts, label }: { counts: Partial<Record<'H' | 'T' | 'I' | 'S' | 'A', number>>; label: string }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {(['H', 'T', 'I', 'S', 'A'] as const).map((k) => {
        const { kata } = statusTokens(k);
        return (
          <li key={k} className={cx(CHIP, STATUS_LOOK[k].pill)}>
            <span aria-hidden className={cx('inline-flex size-5 items-center justify-center rounded-sm text-[0.75rem]', STATUS_LOOK[k].chip)}>
              {k}
            </span>
            {kata}
            <strong className="tabular-nums">{counts[k] ?? 0}</strong>
          </li>
        );
      })}
    </ul>
  );
}

/** A feature of the portal as a whole-row link (64 px high): title, one line of what it is, a chevron. */
export function LinkRow({ href, title, detail, linkAs }: { href: string; title: string; detail?: string; linkAs?: ElementType }) {
  const Link = linkAs ?? 'a';
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-lg border border-garis bg-kapur-raised px-4 py-2 text-tinta no-underline">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong">{title}</span>
        {detail && <span className="text-small text-tinta-muted">{detail}</span>}
      </span>
      <ChevronRight aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-tinta-muted" />
    </Link>
  );
}
