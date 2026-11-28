'use client';

import { Button, Drawer, Field, IconButton, Input, messages } from '@absah/ui';
import { ArrowDown, ArrowUp, PinOff, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  addGroup,
  EMPTY_PREFS,
  groupOf,
  isPinned,
  MAX_GROUP_TITLE,
  moveGroup,
  movePinned,
  moveToGroup,
  parsePrefs,
  removeGroup,
  setHidden,
  togglePin,
  type MenuPrefs,
} from '@/lib/menu-prefs';
import type { VisibleGroup, VisibleItem } from '@/lib/nav-menu';

const t = messages.menuCustom;
const PINNED = '__pinned';
const sentence = (text: string) => text.charAt(0) + text.slice(1).toLowerCase();
const icon = (I: typeof Plus) => <I aria-hidden strokeWidth={1.75} className="size-4" />;

export interface MenuCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The standard menu this person may see (nav-menu.ts), not yet arranged. */
  base: readonly VisibleGroup[];
  prefs: MenuPrefs;
  onSave: (prefs: MenuPrefs) => void;
}

/**
 * "Atur menu" (V12): pin, own groups, hide. Works on a copy: Simpan applies it, Batal leaves the menu as it was. Only items the
 * person may see are listed, so nothing here can open a page their role cannot.
 */
export function MenuCustomizer(props: MenuCustomizerProps) {
  // Mounted per opening, so the copy starts from what is saved each time.
  return props.open ? <Editor {...props} /> : null;
}

function Editor({ onOpenChange, base, prefs, onSave }: MenuCustomizerProps) {
  const [draft, setDraft] = useState(prefs);
  const [newTitle, setNewTitle] = useState('');
  const [tried, setTried] = useState(false);
  const byKey = new Map(base.flatMap((g) => g.items.map((i) => [i.key, i] as const)));
  const pinned = draft.pinned.flatMap((k) => (byKey.has(k) ? [byKey.get(k) as VisibleItem] : []));
  const hiddenCount = draft.hidden.filter((k) => byKey.has(k)).length;
  const emptyTitle = draft.groups.some((g) => !g.title.trim());
  const rename = (id: string, title: string) => setDraft((p) => ({ ...p, groups: p.groups.map((g) => (g.id === id ? { ...g, title: title.slice(0, MAX_GROUP_TITLE) } : g)) }));
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setDraft((p) => addGroup(p, newTitle, Date.now().toString(36)));
    setNewTitle('');
  };
  const place = (key: string, value: string) =>
    setDraft((p) => {
      if (value === PINNED) return isPinned(p, key) ? p : togglePin(p, key);
      const out = isPinned(p, key) ? togglePin(p, key) : p;
      return moveToGroup(out, key, value || null);
    });
  const save = () => {
    setTried(true);
    if (emptyTitle) return;
    onSave(parsePrefs(draft));
    onOpenChange(false);
  };

  return (
    <Drawer open onOpenChange={onOpenChange} title={t.title} actions={<Button onClick={save}>{t.save}</Button>}>
      <p className="m-0 text-small text-tinta-muted">{t.intro}</p>

      <Section title={t.pinnedTitle}>
        {pinned.length === 0 ? (
          <p className="m-0 text-small text-tinta-muted">{t.pinnedEmpty}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {pinned.map((item, i) => (
              <li key={item.key} className="flex items-center gap-2 rounded-md border border-garis px-2 py-1">
                <item.icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
                <span className="min-w-0 flex-1 truncate text-isi font-semibold">{item.label}</span>
                <IconButton label={t.up(item.label)} icon={icon(ArrowUp)} disabled={i === 0} onClick={() => setDraft((p) => movePinned(p, item.key, -1))} />
                <IconButton label={t.down(item.label)} icon={icon(ArrowDown)} disabled={i === pinned.length - 1} onClick={() => setDraft((p) => movePinned(p, item.key, 1))} />
                <IconButton label={messages.sideNav.unpin(item.label)} icon={icon(PinOff)} onClick={() => setDraft((p) => togglePin(p, item.key))} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={t.groupsTitle}>
        {draft.groups.length === 0 && <p className="m-0 text-small text-tinta-muted">{t.groupsEmpty}</p>}
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {draft.groups.map((g, i) => {
            const count = g.items.filter((k) => byKey.has(k) && !draft.hidden.includes(k)).length;
            const invalid = tried && !g.title.trim();
            return (
              <li key={g.id} className="flex flex-col gap-1 rounded-md border border-garis p-2">
                <div className="flex items-end gap-1">
                  <div className="min-w-0 flex-1">
                    <Field label={t.groupName} error={invalid ? t.groupNameRequired : undefined}>
                      <Input value={g.title} maxLength={MAX_GROUP_TITLE} onChange={(e) => rename(g.id, e.target.value)} />
                    </Field>
                  </div>
                  <IconButton label={t.up(g.title || t.groupName)} icon={icon(ArrowUp)} disabled={i === 0} onClick={() => setDraft((p) => moveGroup(p, g.id, -1))} />
                  <IconButton label={t.down(g.title || t.groupName)} icon={icon(ArrowDown)} disabled={i === draft.groups.length - 1} onClick={() => setDraft((p) => moveGroup(p, g.id, 1))} />
                  <IconButton label={t.removeGroup(g.title || t.groupName)} icon={icon(Trash2)} onClick={() => setDraft((p) => removeGroup(p, g.id))} />
                </div>
                <p className="m-0 text-small text-tinta-muted">{t.groupCount(count)}</p>
              </li>
            );
          })}
        </ol>
        <form onSubmit={add} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label={t.newGroup}>
              <Input value={newTitle} maxLength={MAX_GROUP_TITLE} placeholder={t.newGroupPlaceholder} onChange={(e) => setNewTitle(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" disabled={!newTitle.trim()}>
            {icon(Plus)}
            {t.addGroup}
          </Button>
        </form>
      </Section>

      <Section title={t.allTitle} hint={hiddenCount > 0 ? `${t.hiddenCount(hiddenCount)}. ${t.allHint}` : t.allHint}>
        {base.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            {group.title && <p className="m-0 pt-1 text-mini font-bold uppercase tracking-wider text-tinta-muted">{group.title}</p>}
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {group.items.map((item) => {
                const hidden = draft.hidden.includes(item.key);
                const where = isPinned(draft, item.key) ? PINNED : (groupOf(draft, item.key) ?? '');
                return (
                  <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-garis py-2 last:border-b-0">
                    <span className={hidden ? 'flex min-w-40 flex-1 items-center gap-2 text-tinta-muted line-through' : 'flex min-w-40 flex-1 items-center gap-2'}>
                      <item.icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
                      <span className="text-isi">{item.label}</span>
                    </span>
                    <select
                      aria-label={t.place(item.label)}
                      value={where}
                      disabled={hidden}
                      onChange={(e) => place(item.key, e.target.value)}
                      className="box-border min-h-9 max-w-48 rounded-md border border-garis-kuat bg-kapur-raised px-2 text-small text-tinta disabled:opacity-60"
                    >
                      <option value="">{group.title ? `${t.placeDefault} (${sentence(group.title)})` : t.placeDefault}</option>
                      <option value={PINNED}>{t.placePinned}</option>
                      {draft.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title || t.groupName}
                        </option>
                      ))}
                    </select>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-small">
                      <input type="checkbox" aria-label={t.showItem(item.label)} checked={!hidden} onChange={(e) => setDraft((p) => setHidden(p, item.key, !e.target.checked))} className="size-4 cursor-pointer accent-papan" />
                      <span aria-hidden>{t.show}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Section>

      <div className="border-t border-garis pt-4">
        <Button variant="ghost" onClick={() => (setDraft(EMPTY_PREFS), setTried(false))}>
          {t.reset}
        </Button>
      </div>
    </Drawer>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-garis pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="m-0 text-body-strong">{title}</h3>
      {hint && <p className="m-0 text-small text-tinta-muted">{hint}</p>}
      {children}
    </section>
  );
}
