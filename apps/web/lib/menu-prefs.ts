'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { VisibleGroup, VisibleItem } from './nav-menu';

/**
 * How a person arranged their side menu (V12): pinned items on top, groups of their own, items they hid. Only keys are
 * stored; what an item is called, where it goes and whether the person may see it still come from nav-menu.ts, so a role
 * that is taken away also takes its pinned item away. Kept per account and school in this browser: a convenience, not data.
 */
export interface MenuPrefs {
  version: 1;
  /** Item keys in the order they are shown under "Disematkan". */
  pinned: string[];
  hidden: string[];
  /** The person's own groups, in order. An item lives in at most one of them and is then not pinned. */
  groups: { id: string; title: string; items: string[] }[];
}

export const EMPTY_PREFS: MenuPrefs = { version: 1, pinned: [], hidden: [], groups: [] };
export const PINNED_GROUP = 'disematkan';
export const MAX_GROUP_TITLE = 30;

const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

/** Reads what the browser kept; anything malformed becomes the default instead of breaking the menu. */
export function parsePrefs(raw: unknown): MenuPrefs {
  if (!raw || typeof raw !== 'object') return EMPTY_PREFS;
  const r = raw as Record<string, unknown>;
  const groups = Array.isArray(r.groups)
    ? r.groups.flatMap((g) => {
        if (!g || typeof g !== 'object') return [];
        const x = g as Record<string, unknown>;
        if (typeof x.id !== 'string' || typeof x.title !== 'string' || !x.title.trim()) return [];
        return [{ id: x.id, title: x.title.trim().slice(0, MAX_GROUP_TITLE), items: strings(x.items) }];
      })
    : [];
  const grouped = new Set(groups.flatMap((g) => g.items));
  return { version: 1, pinned: strings(r.pinned).filter((k) => !grouped.has(k)), hidden: strings(r.hidden), groups };
}

export interface ArrangedGroup extends VisibleGroup {
  kind: 'pinned' | 'custom' | 'base';
}

/**
 * The menu as the person arranged it: Disematkan, then their own groups, then the rest of the standard menu without what
 * moved or was hidden. Every visible item shows exactly once (or not at all when hidden). Keys the person can no longer
 * see are skipped, empty groups dropped.
 */
export function arrangeMenu(base: readonly VisibleGroup[], prefs: MenuPrefs, pinnedTitle: string): { groups: ArrangedGroup[]; hidden: VisibleItem[] } {
  const byKey = new Map(base.flatMap((g) => g.items.map((i) => [i.key, i] as const)));
  const hiddenSet = new Set(prefs.hidden);
  const placed = new Set<string>();
  const take = (keys: readonly string[]) =>
    keys.flatMap((k) => {
      const item = byKey.get(k);
      if (!item || hiddenSet.has(k) || placed.has(k)) return [];
      placed.add(k);
      return [item];
    });
  const out: ArrangedGroup[] = [];
  const pinned = take(prefs.pinned);
  if (pinned.length > 0) out.push({ key: PINNED_GROUP, title: pinnedTitle, items: pinned, kind: 'pinned' });
  for (const g of prefs.groups) {
    const items = take(g.items);
    if (items.length > 0) out.push({ key: `grup-${g.id}`, title: g.title, items, kind: 'custom' });
  }
  for (const g of base) {
    const items = take(g.items.map((i) => i.key));
    if (items.length > 0) out.push({ ...g, items, kind: 'base' });
  }
  const hidden = prefs.hidden.flatMap((k) => (byKey.has(k) ? [byKey.get(k) as VisibleItem] : []));
  return { groups: out, hidden };
}

const without = (list: readonly string[], key: string) => list.filter((k) => k !== key);
const outOfGroups = (p: MenuPrefs, key: string) => p.groups.map((g) => ({ ...g, items: without(g.items, key) }));
const move = <T,>(list: readonly T[], index: number, dir: -1 | 1): T[] => {
  const to = index + dir;
  if (index < 0 || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to] as T, next[index] as T];
  return next;
};

export const isPinned = (p: MenuPrefs, key: string) => p.pinned.includes(key);
export const groupOf = (p: MenuPrefs, key: string) => p.groups.find((g) => g.items.includes(key))?.id ?? null;

/** Pin or unpin. Pinning takes the item out of the person's group (one place per item) and shows it again if hidden. */
export function togglePin(p: MenuPrefs, key: string): MenuPrefs {
  if (isPinned(p, key)) return { ...p, pinned: without(p.pinned, key) };
  return { ...p, pinned: [...p.pinned, key], hidden: without(p.hidden, key), groups: outOfGroups(p, key) };
}
export function setHidden(p: MenuPrefs, key: string, hidden: boolean): MenuPrefs {
  return { ...p, hidden: hidden ? [...without(p.hidden, key), key] : without(p.hidden, key) };
}
/** Into one of the person's groups (null = back to its standard place). Unpins it. */
export function moveToGroup(p: MenuPrefs, key: string, groupId: string | null): MenuPrefs {
  const groups = outOfGroups(p, key).map((g) => (g.id === groupId ? { ...g, items: [...g.items, key] } : g));
  return { ...p, pinned: groupId ? without(p.pinned, key) : p.pinned, groups };
}
export function addGroup(p: MenuPrefs, title: string, id: string): MenuPrefs {
  const t = title.trim().slice(0, MAX_GROUP_TITLE);
  return t ? { ...p, groups: [...p.groups, { id, title: t, items: [] }] } : p;
}
export function renameGroup(p: MenuPrefs, id: string, title: string): MenuPrefs {
  const t = title.trim().slice(0, MAX_GROUP_TITLE);
  return t ? { ...p, groups: p.groups.map((g) => (g.id === id ? { ...g, title: t } : g)) } : p;
}
/** Removing a group sends its items back to their standard place. */
export const removeGroup = (p: MenuPrefs, id: string): MenuPrefs => ({ ...p, groups: p.groups.filter((g) => g.id !== id) });
export const moveGroup = (p: MenuPrefs, id: string, dir: -1 | 1): MenuPrefs => ({ ...p, groups: move(p.groups, p.groups.findIndex((g) => g.id === id), dir) });
export const movePinned = (p: MenuPrefs, key: string, dir: -1 | 1): MenuPrefs => ({ ...p, pinned: move(p.pinned, p.pinned.indexOf(key), dir) });

const storageKey = (userId: string, schoolId: string) => `absah.menu.${userId}.${schoolId}`;

const CHANGED = 'absah-menu-prefs';
// Without browser storage (private mode, blocked) the arrangement still holds for this visit.
const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * The person's arrangement for this school, read from the browser through useSyncExternalStore: the server and the first
 * paint see the standard menu, then the stored one; another tab's change shows here too.
 */
export function useMenuPrefs(userId: string, schoolId: string | null): [MenuPrefs, (change: (p: MenuPrefs) => MenuPrefs) => void] {
  const key = schoolId ? storageKey(userId, schoolId) : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? readRaw(key) : null),
    () => null,
  );
  const prefs = useMemo(() => {
    try {
      return parsePrefs(JSON.parse(raw ?? 'null'));
    } catch {
      return EMPTY_PREFS;
    }
  }, [raw]);
  const update = useCallback(
    (change: (p: MenuPrefs) => MenuPrefs) => {
      if (!key) return;
      let current = EMPTY_PREFS;
      try {
        current = parsePrefs(JSON.parse(readRaw(key) ?? 'null'));
      } catch {
        // A broken value starts over from the standard menu.
      }
      const next = JSON.stringify(change(current));
      memory.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Kept in memory above.
      }
      window.dispatchEvent(new Event(CHANGED));
    },
    [key],
  );
  return [prefs, update];
}
