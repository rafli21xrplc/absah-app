'use client';

import { Banner, ChildTabs, messages } from '@absah/ui';
import { childLabel, type PortalChild } from '@/lib/portal-children';

/**
 * "Pilih anak" at the top of every portal page. Shown only when there is more than one child to choose
 * from; one child needs no picker. The school is named only for parents with children at several schools.
 */
export function ChildPicker({ items, selected, onSelect, partial }: { items: readonly PortalChild[]; selected: PortalChild | null; onSelect: (child: PortalChild) => void; partial: boolean }) {
  const schoolCount = new Set(items.map((c) => c.schoolId)).size;
  if (items.length < 2 && !partial) return null;
  return (
    <div className="flex flex-col gap-2">
      <ChildTabs
        items={items.map((c) => ({ key: c.key, label: childLabel(c, schoolCount) }))}
        selectedKey={selected?.key ?? null}
        onSelect={(key) => {
          const next = items.find((c) => c.key === key);
          if (next) onSelect(next);
        }}
      />
      {partial && (
        <Banner kind="warning" className="mt-1">
          <span role="status">{messages.portal.partial}</span>
        </Banner>
      )}
    </div>
  );
}
