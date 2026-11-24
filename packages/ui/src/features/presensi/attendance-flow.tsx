'use client';

import { CircleCheck, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState, type ElementType, type ReactNode } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { buttonStyles } from '../../components/button-styles';
import { FilterChip } from '../../components/filter-chip';
import { Field, Input, Textarea } from '../../components/field';
import { ProgressBar } from '../../components/progress-bar';
import { Sheet } from '../../components/sheet';
import { STATUS_LOOK, StatusPill } from '../../components/status-pill';
import { Toast, ToastProvider } from '../../components/toast';
import { statusTokens } from '../../status';
import { AttendanceRow } from './attendance-row';
import {
  absentList,
  canMarkRest,
  counts,
  exceptions,
  initialState,
  isComplete,
  markRestTitle,
  primaryAction,
  reducer,
  STATUSES,
  visibleIds,
  type Mark,
  type Status,
} from './reducer';

const t = messages.presensi;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

export interface FlowStudent {
  id: string;
  name: string;
  /** Small line: the source of an official mark, or the rombel of a mixed group. */
  detail?: string;
  /** What is recorded now ("?" for nothing). */
  mark: Mark;
  /** Set by a source the teacher cannot override. */
  fixed: boolean;
}

/** What the page tells the flow after it tried to send. */
export type SendResult = { kind: 'sent' } | { kind: 'queued' } | { kind: 'failed'; message?: string };

export interface AttendanceFlowProps {
  /** "X-2 · Matematika" */
  title: string;
  /** "Jam ke-3 · 08.30–09.15" */
  subtitle: string;
  /** "Senin, 25 Januari" */
  dateLabel: string;
  /** The short name used in "Presensi X-2 terkirim". */
  shortTitle: string;
  students: readonly FlowStudent[];
  backHref: string;
  linkAs?: ElementType;
  /** Per-lesson sessions ask for the topic of the day (jurnal mengajar). */
  withTopic?: boolean;
  initialTopic?: string;
  /** The sentence about WhatsApp is shown only when someone is Alpa and notifications are on. */
  notifyParents?: boolean;
  /** The help card opens by itself the first time this user fills a session. */
  showHelpFirst?: boolean;
  onHelpSeen?: () => void;
  onSubmit: (input: { exceptions: { id: string; status: Status }[]; topic: string }) => Promise<SendResult>;
  /** After sending: where "Lanjut ke ..." goes. null = no next session. */
  next?: { label: string; href: string } | null;
  /** A banner under the header, e.g. "Tanpa sinyal. Daftar siswa dari salinan di HP." */
  banner?: ReactNode;
  /** No signal: the main button says "Simpan presensi di HP" and the send button of the sheet "Simpan di HP". */
  offline?: boolean;
  /** How many presensi of this teacher wait on the phone: the "Menunggu · n" badge. It reaching 0 turns "tersimpan" into "terkirim". */
  waitingCount?: number;
  /** The session is locked: rows are plain, there is no sending; `readOnlyNote` explains and offers the way out. */
  readOnly?: boolean;
  readOnlyNote?: ReactNode;
  /** For stories and tests: start with a sheet open, a filter on, or on the "terkirim" screen. */
  initialView?: { filter?: 'all' | 'unfilled' | 'absent'; sheetFor?: string; review?: boolean; sent?: boolean; saved?: boolean };
  /** Correction mode: the same screen, but the main button asks for a correction with a reason. */
  correction?: { onSubmit: (changes: { id: string; status: Status }[], reason: string) => Promise<SendResult>; onCancel: () => void };
}

/** Fills one session on a phone: Semua hadir, tap the ones who are not there, check, send. The rules are in reducer.ts. */
export function AttendanceFlow(props: AttendanceFlowProps) {
  const { title, subtitle, dateLabel, shortTitle, students, backHref, linkAs, withTopic = false, initialTopic = '', notifyParents = true, showHelpFirst = false, onHelpSeen, onSubmit, next, banner, offline = false, waitingCount = 1, readOnly = false, readOnlyNote, correction, initialView } = props;
  const Link = linkAs ?? 'a';
  const roster = useMemo(() => students.map((s) => ({ id: s.id, mark: s.mark, fixed: s.fixed })), [students]);
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState(roster, showHelpFirst), ...(initialView?.filter ? { filter: initialView.filter } : {}), ...(initialView?.sheetFor ? { sheetFor: initialView.sheetFor } : {}), ...(initialView?.review ? { review: true } : {}) }));
  const [topic, setTopic] = useState(initialTopic);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'editing' | 'sent' | 'saved'>(initialView?.sent ? 'sent' : initialView?.saved ? 'saved' : 'editing');
  const [result, setResult] = useState<SendResult | null>(null);

  // A different session (or a fresh answer from the server) replaces the roster; nothing of the last one stays.
  const rosterKey = useMemo(() => roster.map((r) => `${r.id}:${r.mark}:${r.fixed ? 1 : 0}`).join('|'), [roster]);
  const loaded = useRef(rosterKey);
  useEffect(() => {
    if (loaded.current === rosterKey) return;
    loaded.current = rosterKey;
    dispatch({ type: 'load', roster, help: false });
  }, [rosterKey, roster]);

  const c = counts(state);
  const ids = visibleIds(state);
  const showRest = !readOnly && !correction && canMarkRest(state);
  const complete = isComplete(state);
  const changes = useMemo(() => students.filter((s) => !s.fixed && state.marks[s.id] !== s.mark && state.marks[s.id] !== '?'), [students, state.marks]);
  const absent = absentList(state);
  const sheetStudent = state.sheetFor ? byId.get(state.sheetFor) : undefined;
  const sheetMark = state.sheetFor ? state.marks[state.sheetFor] : undefined;

  async function send() {
    setBusy(true);
    setResult(null);
    const r = await onSubmit({ exceptions: exceptions(state), topic: topic.trim() });
    setBusy(false);
    setResult(r);
    if (r.kind === 'sent') {
      dispatch({ type: 'closeReview' });
      setPhase('sent');
    }
    if (r.kind === 'queued') {
      dispatch({ type: 'closeReview' });
      setPhase('saved');
    }
  }

  async function sendCorrection() {
    if (!correction) return;
    setBusy(true);
    setResult(null);
    const r = await correction.onSubmit(
      changes.map((s) => ({ id: s.id, status: state.marks[s.id] as Status })),
      reason.trim(),
    );
    setBusy(false);
    setResult(r);
    if (r.kind === 'sent') dispatch({ type: 'closeReview' });
  }

  if (phase === 'sent' || phase === 'saved') {
    // Saved on the phone is "tersimpan" until the last waiting one went out; then it is simply sent.
    const saved = phase === 'saved' && waitingCount > 0;
    return (
      <main className="mx-auto box-border flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <span aria-hidden className={cx('inline-flex size-16 items-center justify-center rounded-lg', saved ? 'bg-stabilo text-on-stabilo' : 'bg-papan text-on-papan')}>
          {saved ? <Smartphone strokeWidth={2.25} className="size-8" /> : <CircleCheck strokeWidth={2.25} className="size-8" />}
        </span>
        <h1 className="m-0 text-h1">{fill(saved ? t.savedTitle : t.sentTitle, { name: shortTitle })}</h1>
        {saved && <span className="rounded-full bg-stabilo px-3 py-1 text-small font-bold text-on-stabilo">{fill(t.waitingBadge, { n: waitingCount })}</span>}
        <p className="m-0 text-body text-tinta-muted">
          {STATUSES.map((s) => `${statusTokens(s).kata} ${c[s]}`).join(' · ')}.
          <br />
          {saved ? `${t.savedBody} ${t.savedUntil}` : t.sentUntil}
        </p>
        <Link href={next?.href ?? backHref} className={cx(buttonStyles({ variant: 'primary', size: '52' }), 'w-full no-underline')}>
          {next ? fill(t.next, { label: next.label }) : t.backToday}
        </Link>
        <Button variant="secondary" size="48" className="w-full" onClick={() => setPhase('editing')}>
          {t.change}
        </Button>
      </main>
    );
  }

  const mainButton = (() => {
    if (readOnly) return null;
    if (correction) {
      return (
        <Button size="52" className="w-full" disabled={changes.length === 0} disabledReason={t.correctionNone} onClick={() => dispatch({ type: 'openReview' })}>
          {fill(t.correctionSubmit, { n: changes.length })}
        </Button>
      );
    }
    return primaryAction(state) === 'review' ? (
      <Button size="52" className="w-full" onClick={() => dispatch({ type: 'openReview' })}>
        {offline ? t.saveOnPhone : t.review}
      </Button>
    ) : (
      <Button variant="stabilo" size="52" className="w-full" onClick={() => dispatch({ type: 'setFilter', filter: 'unfilled' })}>
        {fill(t.showUnfilled, { n: c.unfilled })}
      </Button>
    );
  })();

  return (
    <ToastProvider duration={7000} viewportClassName="pointer-events-none fixed inset-x-0 bottom-28 z-50 m-0 flex list-none flex-col gap-2 p-4 sm:left-auto sm:right-4 sm:w-96">
      <main className="mx-auto box-border flex h-[calc(100dvh-var(--offline-notice,0px))] w-full max-w-xl flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-garis bg-kapur-raised px-3 py-3">
          <Link href={backHref} aria-label={t.back} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-tinta no-underline">
            <span aria-hidden className="text-h2">‹</span>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="m-0 break-words text-h2">{title}</h1>
            <span className="truncate text-small text-tinta-muted">{subtitle}</span>
          </div>
          {!readOnly && !correction && (
            <Button variant="secondary" onClick={() => dispatch({ type: 'openHelp' })} aria-label={t.helpLabel}>
              {t.help}
            </Button>
          )}
        </header>

        {banner && <div className="shrink-0">{banner}</div>}

        <div className="flex shrink-0 flex-col gap-3 bg-kapur px-4 pb-3 pt-4">
          <ProgressBar
            label={t.progressLabel}
            value={c.filled}
            max={c.total}
            textPosition="above"
            aside={dateLabel}
            text={complete ? fill(t.progressDone, { n: c.total }) : fill(t.progress, { k: c.filled, n: c.total })}
          />
          <div role="group" aria-label={t.filterLabel} className="grid grid-cols-3 gap-2">
            <FilterChip label={t.filterAll} count={c.total} selected={state.filter === 'all'} onClick={() => dispatch({ type: 'setFilter', filter: 'all' })} />
            <FilterChip label={t.filterUnfilled} count={c.unfilled} selected={state.filter === 'unfilled'} onClick={() => dispatch({ type: 'setFilter', filter: 'unfilled' })} />
            <FilterChip label={t.filterAbsent} count={c.absent} selected={state.filter === 'absent'} onClick={() => dispatch({ type: 'setFilter', filter: 'absent' })} />
          </div>
        </div>

        {/* The list scrolls on its own; the header, filters and footer stay in the flow, so nothing is ever drawn over a row. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {readOnly && readOnlyNote}
          {state.help && !readOnly && !correction && (
            <section aria-label={t.helpLabel} className="flex flex-col gap-3 rounded-lg bg-papan-soft p-4">
              <h2 className="m-0 text-body-strong">{t.helpTitle}</h2>
              <HelpStep n={1}>
                {t.helpStep1Before}
                <b>{t.helpStep1Strong}</b>
                {t.helpStep1After}
              </HelpStep>
              <HelpStep n={2}>
                {t.helpStep2Before}
                <b>{t.helpStep2Strong}</b>
                {t.helpStep2After}
              </HelpStep>
              <Button
                variant="secondary"
                className="self-start"
                onClick={() => {
                  dispatch({ type: 'closeHelp' });
                  onHelpSeen?.();
                }}
              >
                {t.helpOk}
              </Button>
            </section>
          )}
          {showRest && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'allPresent' })}
              className="box-border flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-md border border-papan bg-papan px-4 py-3 text-left text-on-papan"
            >
              <CircleCheck aria-hidden strokeWidth={1.75} className="size-6 shrink-0" />
              <span className="flex flex-col">
                <span className="text-body-strong">{markRestTitle(state) === 'rest' ? t.restPresent : t.allPresent}</span>
                <span className="text-small">{fill(t.markRestSub, { n: c.unfilled })}</span>
              </span>
            </button>
          )}
          {ids.length === 0 ? (
            <p className="m-0 rounded-md border border-garis bg-kapur-raised p-4 text-center text-body text-tinta-muted">
              {state.filter === 'unfilled' ? t.emptyUnfilled : t.emptyAbsent}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {ids.map((id) => {
                const s = byId.get(id);
                if (!s) return null;
                return (
                  <li key={id}>
                    <AttendanceRow
                      name={s.name}
                      detail={s.detail}
                      mark={state.marks[id] ?? '?'}
                      fixed={s.fixed || readOnly}
                      onOpen={() => dispatch({ type: 'openSheet', id })}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!readOnly && (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-garis bg-kapur-raised px-4 py-3">
            <div className="flex justify-between gap-2 text-small tabular-nums text-tinta-muted">
              {STATUSES.map((s) => (
                <span key={s}>
                  {statusTokens(s).kata} {c[s]}
                </span>
              ))}
            </div>
            {mainButton}
            {correction && (
              <Button variant="secondary" size="48" className="w-full" disabled={busy} onClick={correction.onCancel}>
                {t.correctionCancel}
              </Button>
            )}
          </footer>
        )}
      </main>

      <Toast
        open={state.toast !== null}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'dismissToast' });
        }}
        message={fill(t.toast, { n: state.toast?.count ?? 0 })}
        onUndo={() => dispatch({ type: 'undo' })}
      />

      <Sheet open={sheetStudent !== undefined} onOpenChange={(open) => !open && dispatch({ type: 'closeSheet' })} eyebrow={t.sheetEyebrow} title={sheetStudent?.name ?? ''}>
        <div className="flex flex-col gap-2">
          {STATUSES.map((status) => (
            <StatusChoice key={status} status={status} selected={sheetMark === status} onPick={() => sheetStudent && dispatch({ type: 'choose', id: sheetStudent.id, status })} />
          ))}
        </div>
      </Sheet>

      <Sheet
        open={state.review && !correction}
        onOpenChange={(open) => !open && dispatch({ type: 'closeReview' })}
        title={t.reviewTitle}
        cancelLabel={t.backToCheck}
      >
        <div className="grid grid-cols-5 gap-2">
          {STATUSES.map((status) => (
            <div key={status} className={cx('flex flex-col items-center rounded-md border py-2', STATUS_LOOK[status].pill)}>
              <span className="text-h2 tabular-nums">{c[status]}</span>
              <span className="text-small">{statusTokens(status).kata}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-small font-bold text-tinta-muted">{fill(t.absentTitle, { n: absent.length })}</h3>
          {absent.length === 0 ? (
            <p className="m-0 text-body">{t.allHere}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {absent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="text-body">{byId.get(a.id)?.name}</span>
                  <StatusPill code={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {withTopic && (
          <Field label={t.topic} hint={t.topicOptional}>
            <Input value={topic} maxLength={200} placeholder={t.topicPlaceholder} onChange={(e) => setTopic(e.target.value)} />
          </Field>
        )}
        <p className="m-0 text-small text-tinta-muted">{offline ? t.impactOffline : notifyParents && c.A > 0 ? t.impactWa : t.impact}</p>
        {result?.kind === 'failed' && (
          <Banner kind="error" title={t.sendFailed}>
            {result.message ?? t.sendFailedBody}
          </Banner>
        )}
        <Button size="52" className="w-full" loading={busy} onClick={() => void send()}>
          {offline ? t.saveOnPhoneSheet : t.send}
        </Button>
      </Sheet>

      <Sheet open={state.review && correction !== undefined} onOpenChange={(open) => !open && dispatch({ type: 'closeReview' })} title={messages.presensi.correctionTitle} cancelLabel={t.correctionCancel}>
        <Field label={t.correctionReason}>
          <Textarea value={reason} placeholder={t.correctionPlaceholder} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {result?.kind === 'failed' && (
          <Banner kind="error" title={t.sendFailed}>
            {result.message ?? t.sendFailedBody}
          </Banner>
        )}
        <Button size="52" className="w-full" loading={busy} disabled={reason.trim().length < 5} disabledReason={t.correctionReasonNeeded} onClick={() => void sendCorrection()}>
          {fill(t.correctionSubmit, { n: changes.length })}
        </Button>
      </Sheet>
    </ToastProvider>
  );
}

function HelpStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="m-0 flex gap-3 text-body">
      <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-papan text-small font-bold text-on-papan">
        {n}
      </span>
      <span>{children}</span>
    </p>
  );
}

const DESC: Record<Status, string> = { H: t.descH, T: t.descT, I: t.descI, S: t.descS, A: t.descA };

/** One of the five big choices of the sheet: letter, word, what it means, and "Dipilih" on the current one. */
function StatusChoice({ status, selected, onPick }: { status: Status; selected: boolean; onPick: () => void }) {
  const { kata } = statusTokens(status);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${kata}: ${DESC[status]}`}
      onClick={onPick}
      className={cx('box-border flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-body text-tinta', selected ? cx('border-2', STATUS_LOOK[status].pill) : 'border border-garis bg-kapur-raised')}
    >
      <span aria-hidden className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-body-strong font-bold', STATUS_LOOK[status].chip)}>
        {status}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong">{kata}</span>
        <span className="text-small text-tinta-muted">{DESC[status]}</span>
      </span>
      {selected && <span className="shrink-0 text-small font-bold">{t.chosen}</span>}
    </button>
  );
}
