'use client';

import { AccountMenu, AccountSummary, AppShell, AppTopBar, BottomNav, BrandMark, Button, CommandPalette, menuItemStyles, messages, SchoolSwitcher, SearchTrigger, Select, Sheet, SideNav, ThemeSwitch, useCommandShortcut, useTheme, WorkspaceLabel, type CommandGroupData, type SideNavGroup } from '@absah/ui';
import { LogOut, Monitor, Moon, Search, Sun, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useCapabilities } from '@/lib/capabilities';
import { LEVEL_LABELS } from '@/lib/levels';
import { ACCOUNT_LINKS, currentBarKey, currentItemKey, menuContext, TEACHER_BAR, usesTeacherBar, visibleMenu, type BarItem } from '@/lib/nav-menu';
import { ROLE_LABELS } from '@/lib/roles';
import { STUDENT_READERS } from '@/lib/student-access';
import { useWorkspace } from '@/lib/workspace';
import { useSignOut } from './sign-out-button';
import { MIN_SEARCH, useStudentSearch } from './use-student-search';

const t = messages.sidebar;
const sentence = (text: string) => text.charAt(0) + text.slice(1).toLowerCase();

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
  const { ask: askSignOut, dialog: signOutDialog } = useSignOut();
  const router = useRouter();
  const [, setTheme] = useTheme();
  // Ctrl+K: one palette for the whole staff area. What it can open follows the same menu the person sees.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);
  useCommandShortcut(togglePalette);
  const capabilities = useCapabilities();
  const pathname = usePathname();
  // The sheet is open for the page it was opened on: any change of page (a menu link, the back button) closes it, no effect needed.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);

  const ctx = useMemo(() => menuContext(roles, capabilities), [roles, capabilities]);
  const groups = useMemo(() => visibleMenu(ctx), [ctx]);
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

  const canSearchStudents = ctx.hasRole(...STUDENT_READERS);
  const students = useStudentSearch(paletteOpen && canSearchStudents ? query : '', schoolId);
  const paletteGroups = useMemo<CommandGroupData[]>(() => {
    const go = (href: string) => () => router.push(href);
    const pages = [
      ...groups.flatMap((g) =>
        g.items.map((i) => ({ key: i.key, label: i.label, ...(g.title ? { hint: sentence(g.title) } : {}), icon: <i.icon aria-hidden strokeWidth={1.75} className="size-4" />, onSelect: go(i.href) })),
      ),
      ...ACCOUNT_LINKS.map((l) => ({ key: l.key, label: l.label, hint: messages.sidebar.account, icon: <l.icon aria-hidden strokeWidth={1.75} className="size-4" />, onSelect: go(l.href) })),
    ];
    const icon = (Icon: typeof Sun) => <Icon aria-hidden strokeWidth={1.75} className="size-4" />;
    const actions = [
      { key: 'tema-terang', label: `${messages.theme.label}: ${messages.theme.light}`, icon: icon(Sun), keywords: ['tema', 'light', 'terang', 'putih'], onSelect: () => setTheme('light') },
      { key: 'tema-gelap', label: `${messages.theme.label}: ${messages.theme.dark}`, icon: icon(Moon), keywords: ['tema', 'dark', 'gelap', 'malam'], onSelect: () => setTheme('dark') },
      { key: 'tema-sistem', label: `${messages.theme.label}: ${messages.theme.system}`, icon: icon(Monitor), keywords: ['tema', 'system', 'otomatis'], onSelect: () => setTheme('system') },
      { key: 'keluar', label: messages.sidebar.signOut, icon: icon(LogOut), keywords: ['logout', 'sign out', 'keluar akun'], onSelect: () => void askSignOut() },
    ];
    const others = me.schools.filter((x) => x.id !== schoolId).map((x) => ({ key: x.id, label: x.name, hint: LEVEL_LABELS[x.level], icon: icon(User), onSelect: () => selectSchool(x.id) }));
    const out: CommandGroupData[] = [
      { key: 'halaman', heading: messages.search.pages, items: pages },
      { key: 'tindakan', heading: messages.search.actions, items: actions },
    ];
    if (others.length > 0) out.push({ key: 'sekolah', heading: messages.search.schools, items: others });
    if (canSearchStudents && students.items.length > 0) {
      out.unshift({
        key: 'siswa',
        heading: messages.search.people,
        remote: true,
        items: students.items.map((st) => ({
          key: st.id,
          label: st.name,
          ...(st.enrollment ? { hint: st.enrollment.className } : {}),
          icon: icon(User),
          onSelect: () => router.push(`/siswa?q=${encodeURIComponent(st.name)}`),
        })),
      });
    }
    return out;
  }, [groups, me.schools, schoolId, router, setTheme, askSignOut, selectSchool, canSearchStudents, students.items]);

  const school = me.schools.find((s) => s.id === schoolId);
  if (!school) return <>{children}</>;

  const label = <WorkspaceLabel name={school.name} detail={LEVEL_LABELS[school.level]} />;
  const roleLine = roles.map((r) => ROLE_LABELS[r]).join(', ');
  const choices = me.schools.map((x) => ({ id: x.id, name: x.name, detail: LEVEL_LABELS[x.level] }));
  // What belongs to the person: theme, this phone's notifications, release notes, Keluar. One list for the laptop's popover and
  // the phone's sheet; `compact` is the narrow popover, `onLeave` closes the sheet before the sign-out question opens.
  const accountRows = (compact: boolean, onLeave?: () => void) => (
    <>
      <div className="flex flex-col gap-1 px-1 pb-1">
        <span className="px-2 text-small font-bold uppercase text-tinta-muted">{messages.theme.label}</span>
        <ThemeSwitch compact={compact} />
      </div>
      {ACCOUNT_LINKS.map((l) => (
        <Link key={l.key} href={l.href} prefetch={false} className={menuItemStyles}>
          <l.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
          {l.label}
        </Link>
      ))}
      <button
        type="button"
        data-menu-close
        className={menuItemStyles}
        onClick={() => {
          onLeave?.();
          void askSignOut();
        }}
      >
        <LogOut aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
        {t.signOut}
      </button>
    </>
  );
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
  // A teacher on a phone gets four tabs at the bottom and no top bar (the greeting is the page's own header).
  const teacherBar = usesTeacherBar(ctx);
  const barKey = currentBarKey(pathname);
  const tab = (item: BarItem) => ({
    key: item.key,
    label: item.label,
    href: item.href,
    icon: <item.icon aria-hidden strokeWidth={1.75} className="size-6" />,
    current: item.key === barKey,
  });
  const bottomBar =
    teacherBar && !focusScreen ? <BottomNav linkAs={MenuLink} items={[tab(TEACHER_BAR[0]), tab(TEACHER_BAR[1]), tab(TEACHER_BAR[2]), tab(TEACHER_BAR[3])]} /> : undefined;

  return (
    <AppShell
      sidebar={
        <SideNav groups={navGroups} linkAs={MenuLink} collapsible />
      }
      sidebarHeader={
        <>
          <span className="flex items-center gap-2 px-1">
            <BrandMark size={28} />
            <span className="text-h2 font-bold">{t.brand}</span>
          </span>
          <SchoolSwitcher schools={choices} activeId={school.id} onSelect={selectSchool} />
        </>
      }
      header={<SearchTrigger className="max-w-xl" onClick={() => setPaletteOpen(true)} />}
      sidebarFooter={
        <AccountMenu name={me.user.name} detail={roleLine} email={me.user.email}>
          {accountRows(true)}
        </AccountMenu>
      }
      bottomBar={bottomBar}
      topBar={
        focusScreen || teacherBar ? undefined : (
          <>
            <AppTopBar
              onMenu={() => setOpen(true)}
              actions={
                <Button variant="ghost" aria-label={messages.search.open} aria-haspopup="dialog" onClick={() => setPaletteOpen(true)} className="px-3">
                  <Search aria-hidden strokeWidth={1.75} className="size-5" />
                </Button>
              }
            >
              {label}
            </AppTopBar>
            <Sheet open={open} onOpenChange={setOpen} title="Menu" eyebrow={school.name}>
              {switcher}
              <SideNav groups={navGroups} linkAs={MenuLink} collapsible onNavigate={() => setOpen(false)} />
              <div className="flex flex-col gap-1 border-t border-garis pt-3">
                <div className="px-2 pb-2">
                  <AccountSummary name={me.user.name} detail={roleLine} />
                </div>
                {accountRows(false, () => setOpen(false))}
              </div>
            </Sheet>
          </>
        )
      }
    >
      {children}
      {signOutDialog}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={(next) => {
          setPaletteOpen(next);
          if (!next) setQuery('');
        }} 
        groups={paletteGroups}
        query={query}
        onQueryChange={setQuery}
        busy={students.busy && query.trim().length >= MIN_SEARCH} />
    </AppShell>
  );
}
