import { cx } from '../../cx';

export interface WeekGridCell {
  /** Lesson time, "07.45–08.30". */
  time: string;
  /** What is in the slot; empty slot when missing. */
  subject?: string;
  teacher?: string;
  /** Names the button, e.g. "Senin jam 1: Matematika". Required: the cell is a button. */
  label: string;
  /** This cell is the one being edited. */
  selected?: boolean;
}

export interface WeekGridRow {
  number: number;
  /** One entry per day, in the order of `days`. null = this day has no such jam (a shorter Friday). */
  cells: (WeekGridCell | null)[];
}

export interface WeekGridProps {
  /** Names the table, e.g. "Jadwal mingguan". */
  label: string;
  days: string[];
  rows: WeekGridRow[];
  /** Read-only roles see the lessons but cannot open a cell. */
  disabled?: boolean;
  onPick: (dayIndex: number, number: number) => void;
}

const CELL = 'box-border flex min-h-16 w-full flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left text-body text-tinta';

/**
 * The week of one rombel: days across, jam down. A lesson cell is solid; an empty one is dashed AND says "kosong" in its name, so
 * empty never depends on the border alone. The chosen cell is outlined heavier and carries aria-pressed.
 */
export function WeekGrid({ label, days, rows, disabled = false, onPick }: WeekGridProps) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-lg border border-garis bg-kapur-raised">
      <table className="w-full min-w-170 border-collapse text-left text-body text-tinta">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-kapur">
          <tr>
            <th scope="col" className="w-16 border-b border-garis px-3 py-3 text-small text-tinta-muted">
              Jam
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className="border-b border-garis px-2 py-3 text-small text-tinta-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.number}>
              <th scope="row" className="border-b border-garis px-3 py-2 text-body-strong">
                {r.number}
              </th>
              {r.cells.map((c, i) => (
                <td key={days[i]} className="border-b border-garis p-1 align-top">
                  {c && (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={c.selected ?? false}
                      aria-label={c.label}
                      onClick={() => onPick(i, r.number)}
                      className={cx(
                        CELL,
                        disabled ? 'cursor-default' : 'cursor-pointer',
                        c.selected ? 'border-2 border-papan bg-kapur' : c.subject ? 'border-garis bg-kapur-raised' : 'border-dashed border-garis-kuat bg-kapur-raised',
                      )}
                    >
                      <span className="whitespace-nowrap text-small text-tinta-muted">{c.time}</span>
                      <span className={c.subject ? 'text-body-strong' : 'text-tinta-muted'}>{c.subject ?? '—'}</span>
                      {c.teacher && <span className="text-small text-tinta-muted">{c.teacher}</span>}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
