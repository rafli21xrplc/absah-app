/**
 * The rules of the "isi presensi" screen, in one pure place (U4b contract, rules 1 to 6). Nothing here touches React, the
 * network or the clock, so every rule is tested on its own. The component only draws the state and sends actions.
 *
 * The screen never fills anything the teacher cannot see: a student starts "?" unless an official source already filled it,
 * and "Semua hadir" is a visible button with an Urungkan, not a default.
 */

/** H Hadir, T Telat, I Izin, S Sakit, A Alpa. */
export type Status = 'H' | 'T' | 'I' | 'S' | 'A';
/** A status, or "?" = not filled yet. */
export type Mark = Status | '?';
/** Semua N, Belum n, Tidak hadir n (T + I + S + A). */
export type Filter = 'all' | 'unfilled' | 'absent';

export const STATUSES: readonly Status[] = ['H', 'T', 'I', 'S', 'A'];

export interface RosterEntry {
  id: string;
  /** What is recorded now: "?" for nothing, a status from an official source (izin, gerbang) or an earlier submit. */
  mark: Mark;
  /** Set by a source the teacher cannot override: shown, never editable. */
  fixed: boolean;
}

export interface PresensiState {
  /** Lesson-list order. It never changes, whatever the filter. */
  order: readonly string[];
  marks: Readonly<Record<string, Mark>>;
  fixed: Readonly<Record<string, true>>;
  filter: Filter;
  /** The marks as they were before "Semua hadir": what Urungkan restores. Gone as soon as anything else is chosen. */
  undo: Readonly<Record<string, Mark>> | null;
  /** The "N siswa ditandai Hadir" toast: how many "Semua hadir" changed. */
  toast: { count: number } | null;
  /** The student whose choice sheet is open. */
  sheetFor: string | null;
  review: boolean;
  help: boolean;
}

export type PresensiAction =
  | { type: 'load'; roster: readonly RosterEntry[]; help?: boolean }
  | { type: 'allPresent' }
  | { type: 'undo' }
  | { type: 'dismissToast' }
  | { type: 'openSheet'; id: string }
  | { type: 'closeSheet' }
  | { type: 'choose'; id: string; status: Status }
  | { type: 'setFilter'; filter: Filter }
  | { type: 'openReview' }
  | { type: 'closeReview' }
  | { type: 'openHelp' }
  | { type: 'closeHelp' };

export function initialState(roster: readonly RosterEntry[], help = false): PresensiState {
  const marks: Record<string, Mark> = {};
  const fixed: Record<string, true> = {};
  for (const r of roster) {
    marks[r.id] = r.mark;
    if (r.fixed) fixed[r.id] = true;
  }
  return { order: roster.map((r) => r.id), marks, fixed, filter: 'all', undo: null, toast: null, sheetFor: null, review: false, help };
}

export interface Counts {
  H: number;
  T: number;
  I: number;
  S: number;
  A: number;
  /** Still "?". */
  unfilled: number;
  /** Everyone not "?": the "k" of "k dari N siswa sudah diisi". */
  filled: number;
  total: number;
  /** T + I + S + A. */
  absent: number;
}

export function counts(state: PresensiState): Counts {
  const c: Counts = { H: 0, T: 0, I: 0, S: 0, A: 0, unfilled: 0, filled: 0, total: state.order.length, absent: 0 };
  for (const id of state.order) {
    const m = state.marks[id] ?? '?';
    if (m === '?') c.unfilled += 1;
    else c[m] += 1;
  }
  c.filled = c.total - c.unfilled;
  c.absent = c.T + c.I + c.S + c.A;
  return c;
}

export const isComplete = (state: PresensiState): boolean => counts(state).unfilled === 0;

/** The students the current filter shows, in the fixed lesson order. */
export function visibleIds(state: PresensiState): string[] {
  return state.order.filter((id) => {
    const m = state.marks[id] ?? '?';
    if (state.filter === 'unfilled') return m === '?';
    if (state.filter === 'absent') return m !== '?' && m !== 'H';
    return true;
  });
}

/** Rule 2: there is something to mark, and the list is not narrowed to the absent. */
export function canMarkRest(state: PresensiState): boolean {
  return counts(state).unfilled > 0 && state.filter !== 'absent';
}

/** Rule 2: "Semua hadir" until more than one student is filled, then "Sisanya hadir". */
export function markRestTitle(state: PresensiState): 'all' | 'rest' {
  return counts(state).filled > 1 ? 'rest' : 'all';
}

/** Rule 6: with any "?" left the main button shows them; when complete it opens the review. */
export const primaryAction = (state: PresensiState): 'showUnfilled' | 'review' => (isComplete(state) ? 'review' : 'showUnfilled');

/** What goes to the API: only the students who are not Hadir (the API treats the rest as Hadir). Fixed ones are not sent. */
export function exceptions(state: PresensiState): { id: string; status: Status }[] {
  const out: { id: string; status: Status }[] = [];
  for (const id of state.order) {
    const m = state.marks[id];
    if (m && m !== '?' && m !== 'H' && !state.fixed[id]) out.push({ id, status: m });
  }
  return out;
}

/** The absent students for the review sheet, in lesson order. */
export function absentList(state: PresensiState): { id: string; status: Exclude<Status, 'H'> }[] {
  const out: { id: string; status: Exclude<Status, 'H'> }[] = [];
  for (const id of state.order) {
    const m = state.marks[id];
    if (m && m !== '?' && m !== 'H') out.push({ id, status: m });
  }
  return out;
}

export function reducer(state: PresensiState, action: PresensiAction): PresensiState {
  switch (action.type) {
    case 'load':
      return initialState(action.roster, action.help ?? false);

    case 'allPresent': {
      if (!canMarkRest(state)) return state;
      const marks: Record<string, Mark> = { ...state.marks };
      let count = 0;
      for (const id of state.order) {
        if (marks[id] === '?') {
          marks[id] = 'H';
          count += 1;
        }
      }
      // One snapshot, taken before the change. The list is shown whole again so the teacher sees what happened.
      return { ...state, marks, undo: state.marks, toast: { count }, filter: 'all', help: false };
    }

    case 'undo':
      // Only the last "Semua hadir" can be undone, and only while nothing was chosen after it (choose clears the snapshot).
      return state.undo ? { ...state, marks: state.undo, undo: null, toast: null } : state;

    case 'dismissToast':
      // A toast that is gone leaves no hidden way to undo.
      return { ...state, toast: null, undo: null };

    case 'openSheet':
      // A student filled by a source the teacher cannot override has no choice to open.
      return state.fixed[action.id] || !(action.id in state.marks) ? state : { ...state, sheetFor: action.id };

    case 'closeSheet':
      return { ...state, sheetFor: null };

    case 'choose': {
      if (state.fixed[action.id] || !(action.id in state.marks)) return state;
      // One tap chooses, closes the sheet, and drops the old Urungkan and its toast.
      return { ...state, marks: { ...state.marks, [action.id]: action.status }, sheetFor: null, undo: null, toast: null };
    }

    case 'setFilter':
      return { ...state, filter: action.filter };

    case 'openReview':
      return isComplete(state) ? { ...state, review: true } : state;

    case 'closeReview':
      return { ...state, review: false };

    case 'openHelp':
      return { ...state, help: true };

    case 'closeHelp':
      return { ...state, help: false };
  }
}
