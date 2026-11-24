'use client';

import { AppShell, AppTopBar, Select, Sheet, SideNav, WorkspaceLabel, type SideNavGroup } from '@absah/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useCapabilities } from '@/lib/capabilities';
import { LEVEL_LABELS } from '@/lib/levels';
import { currentItemKey, menuContext, visibleMenu } from '@/lib/nav-menu';
import { useWorkspace } from '@/lib/workspace';

/** Menu links do not prefetch: ~40 of them on every page would cost a cheap phone's data and the school's. */
function MenuLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

/** Screens that are done with one thumb and keep the whole screen: no top bar on a phone (the page has its own Kembali). */
const FOCUS_SCREENS = ['/sesi/'];

/**
 * The staff frame: side menu (240 px, 1024 px and up) or a top bar with a menu sheet (below). What the menu holds comes from
 * lib/nav-menu.ts: roles in the active school and its capabilities, never the level. Without a chosen school there is nothing
 * to navigate yet, so the home page's own picker shows alone.
 */
export function StaffShell({ children }: { children: ReactNode }) {
  const { me, schoolId, roles, selectSchool } = useWorkspace();
  const capabilities = useCapabilities();
  const pathname = usePathname();
  // The sheet is open for the page it was opened on: any change of page (a menu link, the back button) closes it, no effect needed.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);

  const groups = useMemo(() => visibleMenu(menuContext(roles, capabilities)), [roles, capabilities]);
  const current = currentItemKey(groups, pathname);
  const navGroups: SideNavGroup[] = useMemo(
    () =>
      groups.map((g) => ({
        key: g.key,
        ...(g.title ? { title: g.title } : {}),
        items: g.items.map((i) => ({
          key: i.key,
          label: i.label,
          href: i.href,
          icon: <i.icon aria-hidden strokeWidth={1.75} className="size-5" />,
          current: i.key === current,
        })),
      })),
    [groups, current],
  );

  const school = me.schools.find((s) => s.id === schoolId);
  if (!school) return <>{children}</>;

  const label = <WorkspaceLabel name={school.name} detail={LEVEL_LABELS[school.level]} />;
  const switcher =
    me.schools.length > 1 ? (
      <Select aria-label="Sekolah" value={school.id} onChange={(e) => selectSchool(e.target.value)}>
        {me.schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    ) : null;
  const focusScreen = FOCUS_SCREENS.some((p) => pathname.startsWith(p));

  return (
    <AppShell
      sidebar={
        <>
          {label}
          {switcher}
          <SideNav groups={navGroups} linkAs={MenuLink} />
        </>
      }
      topBar={
        focusScreen ? undefined : (
          <>
            <AppTopBar onMenu={() => setOpen(true)}>{label}</AppTopBar>
            <Sheet open={open} onOpenChange={setOpen} title="Menu" eyebrow={school.name}>
              {switcher}
              <SideNav groups={navGroups} linkAs={MenuLink} onNavigate={() => setOpen(false)} />
            </Sheet>
          </>
        )
      }
    >
      {children}
    </AppShell>
  );
}
