import { useId } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { initials } from '../../components/initials';
import { StatusPill } from '../../components/status-pill';
import { statusTokens } from '../../status';
import type { Mark } from './reducer';

export interface AttendanceRowProps {
  name: string;
  /** A small line under the name: where the mark came from ("Izin disetujui", "Gerbang"), or the rombel of a mixed group. */
  detail?: string;
  mark: Mark;
  /** A student the teacher cannot change here: a plain row with no chevron and no button. */
  fixed?: boolean;
  onOpen?: () => void;
}

const BOX = 'flex min-h-16 w-full box-border items-center gap-3 rounded-md border border-garis bg-kapur-raised px-3 py-2 text-left text-body text-tinta';

/**
 * One student. A row is one <button> named "{nama}: {kata}. Ketuk untuk mengubah.", so a screen reader gets the name and the
 * answer in one go. The small line is read after the name through aria-describedby. A student the teacher cannot change
 * (an official source filled it) is a plain row and says so in words.
 */
export function AttendanceRow({ name, detail, mark, fixed = false, onOpen }: AttendanceRowProps) {
  const detailId = useId();
  const word = statusTokens(mark).kata;
  const inner = (
    <>
      <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-garis bg-kapur text-small font-bold text-tinta">
        {initials(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong">{name}</span>
        {detail && (
          <span id={detailId} className="text-small text-tinta-muted">
            {detail}
          </span>
        )}
      </span>
      <StatusPill code={mark} chevron={!fixed} />
    </>
  );
  if (fixed) {
    return <div className={BOX}>{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name}: ${word}. ${messages.presensi.rowHint}`}
      aria-describedby={detail ? detailId : undefined}
      className={cx(BOX, 'cursor-pointer')}
    >
      {inner}
    </button>
  );
}
