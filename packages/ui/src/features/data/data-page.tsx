import type { ReactNode } from 'react';
import { cx } from '../../cx';

export interface DataHeaderProps {
  title: string;
  /** One line under the title: what the school has, as the API reports it. Never a number the page worked out. */
  subtitle?: string;
  /** Buttons and links at the far end. Only actions that work: an action without an endpoint is left out, not disabled. */
  actions?: ReactNode;
  className?: string;
}

/** The top of every "Data sekolah" page (Siswa, Rombel, Mapel, Jadwal, Guru): title, one line of context, the page's actions. */
export function DataHeader({ title, subtitle, actions, className }: DataHeaderProps) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="m-0 text-h1">{title}</h1>
        {subtitle && <p className="m-0 text-body text-tinta-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
