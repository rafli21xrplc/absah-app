'use client';

import { childLabel, type PortalChild } from '@/lib/portal-children';
import styles from '../portal.module.css';

/**
 * "Pilih anak" at the top of every portal page. Shown only when there is more than one child to choose
 * from; one child needs no picker. The school is named only for parents with children at several schools.
 */
export function ChildPicker({ items, selected, onSelect, partial }: { items: readonly PortalChild[]; selected: PortalChild | null; onSelect: (child: PortalChild) => void; partial: boolean }) {
  const schoolCount = new Set(items.map((c) => c.schoolId)).size;
  if (items.length < 2 && !partial) return null;
  return (
    <nav className={styles.picker} aria-label="Pilih anak">
      {items.map((c) => (
        <button key={c.key} type="button" className={styles.pickerItem} aria-pressed={selected?.key === c.key} onClick={() => onSelect(c)}>
          {childLabel(c, schoolCount)}
        </button>
      ))}
      {partial && (
        <p role="status" className={styles.muted}>
          Sebagian sekolah belum bisa dimuat, jadi tidak semua anak tampil. Muat ulang halaman sebentar lagi.
        </p>
      )}
    </nav>
  );
}
