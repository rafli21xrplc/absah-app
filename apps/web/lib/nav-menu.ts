import type { CapabilityKey, CapabilityValues } from '@absah/capabilities';
import type { Role } from '@absah/contracts';
import {
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CircleAlert,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Handshake,
  LayoutGrid,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Notebook,
  PenLine,
  Plug,
  Receipt,
  ScrollText,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  UserCheck,
  UserRound,
  UserRoundCog,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { CORRECTION_DECIDERS } from './attendance';
import { BILLING_READERS } from './billing';
import { DASHBOARD_READERS } from './dashboard';
import { EXAM_VIEWING } from './exam';
import { GATE_VIEWERS } from './gate';
import { HABIT_SUMMARY_READERS } from './habits';
import { JOURNAL_VIEWERS } from './journal';
import { BK_READERS, EARLY_WARNING_READERS, FOLLOWUP_READERS, POINT_RECORDERS } from './ksw';
import { MBG_READERS } from './mbg';
import { MEMORIZATION_WRITERS } from './memorization';
import { NOTIFY_VIEWERS } from './notify';
import { RECAP_READERS } from './report';
import { SCHEDULE_PAGE_READERS } from './schedule-access';
import { STUDENT_MANAGERS, STUDENT_READERS } from './student-access';
import { STUDENT_BILLING_READING } from './student-billing';
import { SUBSTITUTION_READING, TEACHER_CHECKIN, TEACHER_LEAVE_DECIDING, TEACHER_REPORT_READING } from './teacher';
import { UKS_STAFF } from './uks';
import { VISITOR_VIEWERS } from './visitors';

/**
 * What decides whether a menu entry shows: the user's roles in the active school and the school's capabilities.
 * Never the school level: a level only matters through the capabilities it switches on (CLAUDE.md rule 1).
 */
export interface MenuContext {
  hasRole: (...roles: Role[]) => boolean;
  isAdmin: boolean;
  cap: <K extends CapabilityKey>(key: K) => CapabilityValues[K] | undefined;
}

export function menuContext(roles: readonly Role[], capabilities: Partial<CapabilityValues>): MenuContext {
  return {
    hasRole: (...wanted) => wanted.some((r) => roles.includes(r)),
    isAdmin: roles.includes('admin'),
    cap: (key) => capabilities[key],
  };
}

export interface MenuItem {
  key: string;
  label: string | ((ctx: MenuContext) => string);
  href: string;
  icon: LucideIcon;
  /** Absent = everyone who is signed in. An entry that is not visible is not rendered at all (not disabled). */
  visible?: (ctx: MenuContext) => boolean;
}

export interface MenuGroup {
  key: string;
  /** Small caps heading. Untitled groups are plain lists. */
  title?: string;
  items: readonly MenuItem[];
}

const on = (ctx: MenuContext, key: Extract<CapabilityKey, `${string}.${string}`>) => ctx.cap(key) === true;
const perPeriod = (ctx: MenuContext) => ctx.cap('attendance.mode') === 'per_period';

/**
 * The staff menu as data. Roles come from the same lists the home cards and the pages use (lib/*), so the three cannot drift
 * apart. Order and groups follow the Main board (a titled DATA SEKOLAH and LAPORAN, Pengaturan last); features the board does
 * not draw yet sit in their own groups so nothing the app can do becomes unreachable.
 *
 * Not here on purpose: Mata pelajaran, Guru dan staf and Tahun ajaran (no page yet, they come with U6c and U6e: a link to
 * nothing is worse than no link) and TPPK (access is membership of the team, which only the API knows: it stays a home card).
 */
export const STAFF_MENU: readonly MenuGroup[] = [
  {
    key: 'inti',
    items: [
      { key: 'dasbor', label: 'Dasbor sekolah', href: '/dasbor', icon: LayoutDashboard, visible: (c) => c.hasRole(...DASHBOARD_READERS) },
      { key: 'hari-ini', label: 'Presensi kelas', href: '/hari-ini', icon: CalendarCheck },
      { key: 'gerbang', label: 'Gerbang', href: '/gerbang', icon: DoorOpen, visible: (c) => c.hasRole(...GATE_VIEWERS) && on(c, 'gate.enabled') },
      { key: 'izin', label: 'Izin siswa', href: '/izin', icon: FileText },
      { key: 'kegiatan', label: 'Kegiatan', href: '/kegiatan', icon: Sparkles },
      { key: 'mbg', label: 'Makan Bergizi Gratis', href: '/mbg', icon: UtensilsCrossed, visible: (c) => c.hasRole(...MBG_READERS) && on(c, 'mbg.enabled') },
    ],
  },
  {
    key: 'data',
    title: 'DATA SEKOLAH',
    items: [
      { key: 'siswa', label: 'Siswa', href: '/siswa', icon: Users, visible: (c) => c.hasRole(...STUDENT_READERS) },
      { key: 'rombel', label: 'Rombel', href: '/rombel', icon: UsersRound, visible: (c) => c.hasRole(...STUDENT_READERS) },
      { key: 'mapel', label: 'Mata pelajaran', href: '/mapel', icon: BookOpen, visible: (c) => c.hasRole(...SCHEDULE_PAGE_READERS) && perPeriod(c) },
      { key: 'jadwal', label: (c) => (c.cap('attendance.mode') === 'daily' ? 'Wali kelas dan jadwal' : 'Jadwal pelajaran'), href: '/jadwal', icon: CalendarDays, visible: (c) => c.hasRole(...SCHEDULE_PAGE_READERS) },
      {
        key: 'impor',
        label: (c) => `Impor ${c.cap('data.source') === 'emis' ? 'EMIS' : 'Dapodik'}`,
        href: '/import',
        icon: Download,
        visible: (c) => c.hasRole(...STUDENT_MANAGERS) && (c.cap('data.source') === 'dapodik' || c.cap('data.source') === 'emis'),
      },
    ],
  },
  {
    key: 'laporan',
    title: 'LAPORAN',
    items: [
      { key: 'rekap', label: 'Rekap dan ekspor', href: '/rekap', icon: FileSpreadsheet, visible: (c) => c.hasRole(...RECAP_READERS) },
      { key: 'jam-siswa', label: 'Jam siswa', href: '/jam-siswa', icon: Clock, visible: (c) => c.hasRole(...RECAP_READERS) && perPeriod(c) },
      { key: 'jurnal', label: 'Jurnal mengajar', href: '/jurnal', icon: Notebook, visible: (c) => c.hasRole(...JOURNAL_VIEWERS) && perPeriod(c) },
      { key: 'koreksi', label: (c) => (c.hasRole(...CORRECTION_DECIDERS) ? 'Koreksi presensi' : 'Koreksi saya'), href: '/koreksi', icon: PenLine },
      { key: 'laporan-guru', label: 'Kehadiran guru', href: '/laporan-guru', icon: UserCheck, visible: (c) => c.hasRole(...TEACHER_REPORT_READING) && on(c, 'teacher.attendance') },
      {
        key: 'kebiasaan',
        label: 'Jurnal 7 kebiasaan',
        href: '/kebiasaan',
        icon: ListChecks,
        visible: (c) => c.hasRole(...HABIT_SUMMARY_READERS) && (c.cap('habits.kaih') ?? 'off') !== 'off',
      },
    ],
  },
  {
    key: 'kesiswaan',
    title: 'KESISWAAN',
    items: [
      { key: 'poin', label: 'Poin kesiswaan', href: '/poin', icon: Star, visible: (c) => c.hasRole(...POINT_RECORDERS) && on(c, 'student.points') },
      { key: 'tindak-lanjut', label: 'Tindak lanjut', href: '/tindak-lanjut', icon: ClipboardCheck, visible: (c) => c.hasRole(...FOLLOWUP_READERS) && on(c, 'student.points') },
      { key: 'peringatan-dini', label: 'Peringatan dini', href: '/peringatan-dini', icon: CircleAlert, visible: (c) => c.hasRole(...EARLY_WARNING_READERS) && on(c, 'student.early_warning') },
      { key: 'bk', label: 'Catatan BK', href: '/bk', icon: ShieldAlert, visible: (c) => c.hasRole(...BK_READERS) && on(c, 'student.counseling') },
      { key: 'uks', label: 'UKS', href: '/uks', icon: Stethoscope, visible: (c) => c.hasRole(...UKS_STAFF) && on(c, 'student.uks') },
      { key: 'hafalan', label: 'Setoran hafalan', href: '/hafalan', icon: BookOpenCheck, visible: (c) => c.hasRole(...MEMORIZATION_WRITERS) && on(c, 'religious.memorization') },
      { key: 'tamu', label: 'Buku tamu', href: '/tamu', icon: ClipboardList, visible: (c) => c.hasRole(...VISITOR_VIEWERS) && on(c, 'gate.enabled') && on(c, 'gate.visitors') },
      { key: 'penjemputan', label: 'Penjemputan', href: '/penjemputan', icon: Handshake, visible: (c) => on(c, 'gate.pickup') },
    ],
  },
  {
    key: 'guru',
    title: 'GURU',
    items: [
      { key: 'absen-guru', label: 'Absen guru', href: '/absen-guru', icon: UserCheck, visible: (c) => c.hasRole(...TEACHER_CHECKIN) && on(c, 'teacher.attendance') },
      {
        key: 'izin-guru',
        label: 'Izin guru',
        href: '/izin-guru',
        icon: FileText,
        visible: (c) => (c.hasRole(...TEACHER_CHECKIN) || c.hasRole(...TEACHER_LEAVE_DECIDING)) && on(c, 'teacher.attendance'),
      },
      { key: 'pengganti', label: 'Guru pengganti', href: '/pengganti', icon: UserRoundCog, visible: (c) => c.hasRole(...SUBSTITUTION_READING) && on(c, 'teacher.attendance') },
    ],
  },
  {
    key: 'lainnya',
    title: 'LAINNYA',
    items: [
      { key: 'pkl', label: 'PKL', href: '/pkl', icon: GraduationCap, visible: (c) => on(c, 'pkl.enabled') },
      { key: 'penghubung', label: 'Buku penghubung', href: '/penghubung', icon: MessageSquareText, visible: (c) => on(c, 'portal.liaison') },
      { key: 'ujian', label: (c) => (c.hasRole(...EXAM_VIEWING) ? 'Ujian' : 'Ruang ujian saya'), href: '/ujian', icon: ScrollText, visible: (c) => on(c, 'exam.enabled') },
      { key: 'tagihan-siswa', label: 'Tagihan siswa', href: '/tagihan-siswa', icon: Receipt, visible: (c) => c.hasRole(...STUDENT_BILLING_READING) && on(c, 'student.billing') },
      { key: 'notifikasi', label: 'Notifikasi WhatsApp', href: '/notifikasi', icon: Bell, visible: (c) => c.hasRole(...NOTIFY_VIEWERS) },
      { key: 'tagihan', label: 'Tagihan Absah', href: '/tagihan', icon: Wallet, visible: (c) => c.hasRole(...BILLING_READERS) },
    ],
  },
  {
    key: 'pengaturan',
    items: [
      { key: 'setup', label: 'Pengaturan sekolah', href: '/setup', icon: Settings, visible: (c) => c.isAdmin },
      { key: 'ekspor-data', label: 'Ekspor data sekolah', href: '/ekspor-data', icon: Download, visible: (c) => c.isAdmin },
      { key: 'integrasi', label: 'Integrasi', href: '/integrasi', icon: Plug, visible: (c) => c.isAdmin && on(c, 'platform.openApi') },
      { key: 'notif-hp', label: 'Notifikasi di HP ini', href: '/pengaturan', icon: Smartphone },
      { key: 'rilis', label: 'Catatan rilis', href: '/rilis', icon: HeartPulse },
    ],
  },
];

export interface VisibleItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface VisibleGroup {
  key: string;
  title?: string;
  items: VisibleItem[];
}

/** The menu this user sees: hidden entries dropped, labels resolved, groups left empty dropped. */
export function visibleMenu(ctx: MenuContext, menu: readonly MenuGroup[] = STAFF_MENU): VisibleGroup[] {
  const out: VisibleGroup[] = [];
  for (const group of menu) {
    const items: VisibleItem[] = group.items
      .filter((item) => item.visible?.(ctx) ?? true)
      .map((item) => ({ key: item.key, label: typeof item.label === 'function' ? item.label(ctx) : item.label, href: item.href, icon: item.icon }));
    if (items.length > 0) out.push({ key: group.key, ...(group.title ? { title: group.title } : {}), items });
  }
  return out;
}

/** The entry for the current path: exact match, or a deeper page of it (/siswa/kontak belongs to /siswa). Longest href wins. */
export function currentItemKey(groups: readonly VisibleGroup[], pathname: string): string | null {
  let best: { key: string; length: number } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const match = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.length)) best = { key: item.key, length: item.href.length };
    }
  }
  return best?.key ?? null;
}

/** The people who teach and run no part of the school: on a phone they get the bottom bar instead of the menu sheet. */
export function usesTeacherBar(ctx: MenuContext): boolean {
  return ctx.hasRole('guru', 'wali_kelas') && !ctx.hasRole('admin', 'operator', 'kepsek', 'wakasek');
}

export interface BarItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * The teacher's four bottom tabs. The design draws Hari ini, Jadwal, Riwayat, Akun, but a teacher cannot read the schedule page
 * and no history page exists, and a link to nothing is not allowed. So: Izin (a thing a teacher does daily), Menu (the home page,
 * which still holds every card a teacher can open) and Akun (this phone's settings). When Jadwal and Riwayat exist, swap them in here.
 */
export const TEACHER_BAR: readonly [BarItem, BarItem, BarItem, BarItem] = [
  { key: 'hari-ini', label: 'Hari ini', href: '/hari-ini', icon: CalendarCheck },
  { key: 'izin', label: 'Izin', href: '/izin', icon: FileText },
  { key: 'menu', label: 'Menu', href: '/', icon: LayoutGrid },
  { key: 'akun', label: 'Akun', href: '/pengaturan', icon: UserRound },
];

/** The tab for this path. Home ("/") only matches itself; the others also match the pages under them. */
export function currentBarKey(pathname: string): string | null {
  for (const item of TEACHER_BAR) {
    if (item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)) return item.key;
  }
  return null;
}
