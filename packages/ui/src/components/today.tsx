import { CircleAlert, CircleCheck, Lock } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { buttonStyles } from './button-styles';
import { Card } from './card';

/** The top of the teacher's day: the long date small, the greeting large. */
export function GreetingHeader({ date, greeting }: { date: string; greeting: string }) {
  return (
    <header className="flex flex-col gap-1">
      {date && <p className="m-0 text-small text-tinta-muted">{date}</p>}
      <h1 className="m-0 text-h1">{greeting}</h1>
    </header>
  );
}

/** A titled group of sessions ("Berikutnya", "Sudah selesai"). Not a named landmark: a day with four groups would add four. */
export function SessionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-small font-bold text-tinta-muted">{title}</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>
    </section>
  );
}

export interface SessionHeroProps {
  /** "Sedang berlangsung". */
  pill?: string;
  /** "08.30–09.15" */
  time?: string;
  title: string;
  /** "Jam ke-3 · 25 siswa" */
  meta?: string;
  href: string;
  /** Full spoken name of the link, e.g. "Isi presensi X-2 · Matematika". */
  actionLabel?: string;
  linkAs?: ElementType;
}

/** The session in progress: one big card and the one primary action of the screen. */
export function SessionHero({ pill = messages.today.current, time, title, meta, href, actionLabel, linkAs }: SessionHeroProps) {
  const Link = linkAs ?? 'a';
  return (
    <Card as="article" tone="active" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-stabilo px-3 py-1 text-small font-bold text-on-stabilo">{pill}</span>
        {time && <span className="text-small tabular-nums text-tinta-muted">{time}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-h2">{title}</h2>
        {meta && <p className="m-0 text-body text-tinta-muted">{meta}</p>}
      </div>
      <Link href={href} aria-label={actionLabel ?? `${messages.today.fill} ${title}`} className={cx(buttonStyles({ variant: 'primary', size: '52' }), 'w-full no-underline')}>
        {messages.today.fill}
      </Link>
    </Card>
  );
}

export type SessionItemVariant = 'next' | 'unfilled' | 'done' | 'missed' | 'locked';

export interface SessionItemProps {
  variant: SessionItemVariant;
  time?: string;
  title: string;
  meta?: string;
  /** A row without a link is only information. Rows have no button: the hero card is the one action. */
  href?: string;
  linkAs?: ElementType;
}

const STATE: Record<Exclude<SessionItemVariant, 'next' | 'done'>, { text: string; tone: string; icon: typeof CircleAlert }> = {
  unfilled: { text: messages.today.unfilled, tone: 'text-telat', icon: CircleAlert },
  missed: { text: messages.today.missed, tone: 'text-alpa', icon: CircleAlert },
  locked: { text: messages.today.locked, tone: 'text-tinta-muted', icon: Lock },
};

/** One quiet row of a session that is not the current one. The state is a word plus an icon, never colour alone. */
export function SessionItem({ variant, time, title, meta, href, linkAs }: SessionItemProps) {
  const Link = linkAs ?? 'a';
  const state = variant === 'next' || variant === 'done' ? null : STATE[variant];
  const body = (
    <>
      {variant === 'done' && <CircleCheck aria-hidden strokeWidth={1.75} className="size-6 shrink-0 text-hadir" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong">{title}</span>
        {meta && <span className="text-small text-tinta-muted">{meta}</span>}
        {state && (
          <span className={cx('mt-1 inline-flex items-center gap-1 text-small font-bold', state.tone)}>
            <state.icon aria-hidden strokeWidth={1.75} className="size-4" />
            {state.text}
          </span>
        )}
      </span>
      {time && <span className="shrink-0 text-small tabular-nums text-tinta-muted">{time}</span>}
    </>
  );
  const box = 'flex min-h-16 items-center gap-3 rounded-md border border-garis bg-kapur-raised px-4 py-3 text-tinta no-underline';
  return <li>{href ? <Link href={href} className={box}>{body}</Link> : <div className={box}>{body}</div>}</li>;
}
