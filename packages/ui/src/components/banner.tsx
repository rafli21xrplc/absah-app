import { CircleAlert, Info, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

export type BannerKind = 'info' | 'warning' | 'offline' | 'error';

// The board's own text and border colours for banners are not in tokens.json, so the body is tinta and the border is the
// status colour at low strength. The title keeps the status colour. Icon, bold title and colour always travel together.
const KIND: Record<BannerKind, { box: string; title: string; icon: typeof Info; role: 'status' | 'alert' }> = {
  info: { box: 'border-papan/30 bg-papan-soft', title: 'text-papan', icon: Info, role: 'status' },
  warning: { box: 'border-telat/30 bg-telat-soft', title: 'text-telat', icon: TriangleAlert, role: 'status' },
  offline: { box: 'border-telat/30 bg-telat-soft', title: 'text-telat', icon: WifiOff, role: 'status' },
  error: { box: 'border-alpa/30 bg-alpa-soft', title: 'text-alpa', icon: CircleAlert, role: 'alert' },
};

export interface BannerProps {
  kind?: BannerKind;
  /** Bold lead-in. Defaults to the kind's own word ("Info", "Tanpa sinyal", ...). */
  title?: string;
  /** One sentence: what happened and what is safe. Never an error code. */
  children: ReactNode;
  /** A more exact icon than the kind's own, e.g. a padlock for a locked account. Colour and bold title still carry the kind. */
  icon?: LucideIcon;
  /** Optional button or link on the right, e.g. "Coba lagi". */
  action?: ReactNode;
  className?: string;
}

export function Banner({ kind = 'info', title, children, icon, action, className }: BannerProps) {
  const k = KIND[kind];
  const Icon = icon ?? k.icon;
  return (
    <div role={k.role} className={cx('motion-banner-in flex items-start gap-3 rounded-md border px-4 py-3 text-body text-tinta', k.box, className)}>
      <Icon aria-hidden strokeWidth={1.75} className={cx('mt-px size-5 shrink-0', k.title)} />
      <p className="m-0 min-w-0 flex-1">
        <b className={cx('font-bold', k.title)}>{title ?? messages.banner[kind]}.</b> {children}
      </p>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
