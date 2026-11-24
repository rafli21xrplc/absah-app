import { describe, expect, it } from 'vitest';
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
  visibleIds,
  type Mark,
  type PresensiAction,
  type PresensiState,
  type RosterEntry,
} from './reducer';

const roster = (n: number, preset: Record<number, Mark> = {}, fixedAt: number[] = []): RosterEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, mark: preset[i + 1] ?? '?', fixed: fixedAt.includes(i + 1) }));
const start = (n = 25, preset: Record<number, Mark> = {}, fixedAt: number[] = []) => initialState(roster(n, preset, fixedAt));
const run = (state: PresensiState, ...actions: PresensiAction[]) => actions.reduce(reducer, state);
const choose = (id: string, status: 'H' | 'T' | 'I' | 'S' | 'A'): PresensiAction => ({ type: 'choose', id, status });

describe('rule 1: everyone starts "?"', () => {
  it('nobody is filled at the start, none is Hadir by default', () => {
    const c = counts(start());
    expect(c.unfilled).toBe(25);
    expect(c.H).toBe(0);
    expect(c.filled).toBe(0);
  });

  it('a student an official source already filled keeps that mark, and one the teacher cannot change stays fixed', () => {
    const s = start(25, { 22: 'I', 3: 'H' }, [22]);
    expect(s.marks['s22']).toBe('I');
    expect(s.marks['s3']).toBe('H');
    expect(counts(s).filled).toBe(2);
    expect(run(s, { type: 'openSheet', id: 's22' }).sheetFor).toBeNull();
    expect(run(s, choose('s22', 'A')).marks['s22']).toBe('I');
  });

  it('a student filled from the gate (not fixed) can be changed by the teacher', () => {
    const s = start(25, { 3: 'H' });
    expect(run(s, choose('s3', 'T')).marks['s3']).toBe('T');
  });

  it('nothing is sent for a fixed student', () => {
    const s = run(start(5, { 2: 'I' }, [2]), { type: 'allPresent' }, choose('s3', 'A'));
    expect(exceptions(s)).toEqual([{ id: 's3', status: 'A' }]);
  });
});

describe('rule 2: Semua hadir', () => {
  it('turns only the "?" students into Hadir, and keeps what was already filled', () => {
    const s = run(start(25, { 22: 'I' }), { type: 'allPresent' });
    expect(counts(s).H).toBe(24);
    expect(s.marks['s22']).toBe('I');
    expect(counts(s).unfilled).toBe(0);
  });

  it('says how many it marked, in a toast', () => {
    expect(run(start(25, { 22: 'I' }), { type: 'allPresent' }).toast).toEqual({ count: 24 });
    expect(run(start(25), { type: 'allPresent' }).toast).toEqual({ count: 25 });
  });

  it('is titled "Semua hadir" until more than one student is filled, then "Sisanya hadir"', () => {
    expect(markRestTitle(start(25))).toBe('all');
    expect(markRestTitle(start(25, { 1: 'I' }))).toBe('all');
    expect(markRestTitle(start(25, { 1: 'I', 2: 'S' }))).toBe('rest');
    expect(markRestTitle(run(start(25), choose('s1', 'A'), choose('s2', 'T')))).toBe('rest');
  });

  it('is gone when nothing is "?"', () => {
    const s = run(start(3), { type: 'allPresent' });
    expect(canMarkRest(s)).toBe(false);
    expect(run(s, { type: 'allPresent' })).toBe(s);
  });

  it('is gone while the Tidak hadir filter is on, and back when it is not', () => {
    const s = run(start(5), { type: 'setFilter', filter: 'absent' });
    expect(canMarkRest(s)).toBe(false);
    expect(run(s, { type: 'allPresent' })).toBe(s);
    expect(canMarkRest(run(s, { type: 'setFilter', filter: 'unfilled' }))).toBe(true);
    expect(canMarkRest(run(s, { type: 'setFilter', filter: 'all' }))).toBe(true);
  });

  it('shows the whole list again so the teacher sees what changed, and closes the help card', () => {
    const s = run(initialState(roster(5), true), { type: 'setFilter', filter: 'unfilled' }, { type: 'allPresent' });
    expect(s.filter).toBe('all');
    expect(s.help).toBe(false);
  });

  it('Sisanya hadir after some were filled changes only the rest', () => {
    const s = run(start(5), choose('s1', 'A'), choose('s2', 'T'), { type: 'allPresent' });
    expect([s.marks['s1'], s.marks['s2'], s.marks['s3'], s.marks['s4'], s.marks['s5']]).toEqual(['A', 'T', 'H', 'H', 'H']);
    expect(s.toast).toEqual({ count: 3 });
  });
});

describe('Urungkan', () => {
  it('puts every student back as they were before Semua hadir', () => {
    const before = start(25, { 22: 'I' }, [22]);
    const after = run(before, { type: 'allPresent' }, { type: 'undo' });
    expect(after.marks).toEqual(before.marks);
    expect(after.toast).toBeNull();
    expect(after.undo).toBeNull();
  });

  it('does not undo a change made after it: choosing drops the snapshot, so a late Urungkan does nothing', () => {
    const s = run(start(5), { type: 'allPresent' }, choose('s2', 'A'));
    expect(s.undo).toBeNull();
    expect(s.toast).toBeNull();
    const again = run(s, { type: 'undo' });
    expect(again).toBe(s);
    expect(again.marks['s2']).toBe('A');
    expect(counts(again).H).toBe(4);
  });

  it('can be used once', () => {
    const s = run(start(5), { type: 'allPresent' }, { type: 'undo' });
    expect(run(s, { type: 'undo' })).toBe(s);
  });

  it('a toast that went away leaves no hidden way to undo', () => {
    const s = run(start(5), { type: 'allPresent' }, { type: 'dismissToast' });
    expect(s.undo).toBeNull();
    expect(run(s, { type: 'undo' })).toBe(s);
    expect(counts(s).H).toBe(5);
  });

  it('keeps one snapshot: a second Semua hadir (after undo) snapshots again', () => {
    const s = run(start(5), { type: 'allPresent' }, { type: 'undo' }, { type: 'allPresent' });
    expect(s.undo).not.toBeNull();
    expect(counts(s).H).toBe(5);
  });
});

describe('rule 3: the choice sheet', () => {
  it('opens for a student, and one tap chooses, closes it, and drops the old Urungkan and toast', () => {
    let s = run(start(5), { type: 'allPresent' });
    s = run(s, { type: 'openSheet', id: 's2' });
    expect(s.sheetFor).toBe('s2');
    s = run(s, choose('s2', 'S'));
    expect(s.marks['s2']).toBe('S');
    expect(s.sheetFor).toBeNull();
    expect(s.undo).toBeNull();
    expect(s.toast).toBeNull();
  });

  it('Batal closes it and changes nothing', () => {
    const open = run(start(5), { type: 'allPresent' }, { type: 'openSheet', id: 's2' });
    const closed = run(open, { type: 'closeSheet' });
    expect(closed.marks).toEqual(open.marks);
    expect(closed.undo).toBe(open.undo);
  });

  it('every one of the five choices can be picked, also over an earlier choice', () => {
    for (const status of ['H', 'T', 'I', 'S', 'A'] as const) {
      expect(run(start(3), choose('s1', 'A'), choose('s1', status)).marks['s1']).toBe(status);
    }
  });

  it('an unknown student is ignored', () => {
    const s = start(3);
    expect(run(s, { type: 'openSheet', id: 'nope' })).toBe(s);
    expect(run(s, choose('nope', 'A'))).toBe(s);
  });
});

describe('rule 4: filters', () => {
  const s = run(start(6), choose('s1', 'H'), choose('s2', 'T'), choose('s3', 'I'), choose('s4', 'S'), choose('s5', 'A'));

  it('Semua N, Belum n, Tidak hadir n counts T + I + S + A', () => {
    const c = counts(s);
    expect(c.total).toBe(6);
    expect(c.unfilled).toBe(1);
    expect(c.absent).toBe(4);
  });

  it('the filters show the right students and never reorder them', () => {
    expect(visibleIds(s)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(visibleIds(run(s, { type: 'setFilter', filter: 'unfilled' }))).toEqual(['s6']);
    expect(visibleIds(run(s, { type: 'setFilter', filter: 'absent' }))).toEqual(['s2', 's3', 's4', 's5']);
  });

  it('changing a mark under a filter keeps lesson order', () => {
    const f = run(start(4), choose('s3', 'A'), choose('s1', 'A'), { type: 'setFilter', filter: 'absent' });
    expect(visibleIds(f)).toEqual(['s1', 's3']);
  });

  it('choosing in the Tidak hadir filter can make a student leave the list (Hadir)', () => {
    const f = run(start(3), choose('s1', 'A'), { type: 'setFilter', filter: 'absent' }, choose('s1', 'H'));
    expect(visibleIds(f)).toEqual([]);
  });
});

describe('rule 5: progress', () => {
  it('counts the filled', () => {
    expect(counts(start(25)).filled).toBe(0);
    expect(counts(run(start(25), choose('s1', 'A'))).filled).toBe(1);
  });
  it('is complete only when nobody is "?"', () => {
    expect(isComplete(start(2))).toBe(false);
    expect(isComplete(run(start(2), choose('s1', 'H')))).toBe(false);
    expect(isComplete(run(start(2), { type: 'allPresent' }))).toBe(true);
  });
  it('a class of nobody is complete', () => expect(isComplete(start(0))).toBe(true));
});

describe('rule 6: the main button', () => {
  it('shows the "?" students while any is left, and opens the review when complete', () => {
    expect(primaryAction(start(3))).toBe('showUnfilled');
    expect(primaryAction(run(start(3), { type: 'allPresent' }))).toBe('review');
  });

  it('the review cannot be opened with a "?" left, so there is no way to send an unfilled class', () => {
    const s = start(3);
    expect(run(s, { type: 'openReview' }).review).toBe(false);
    const full = run(s, { type: 'allPresent' }, { type: 'openReview' });
    expect(full.review).toBe(true);
    expect(run(full, { type: 'closeReview' }).review).toBe(false);
  });
});

describe('what is sent', () => {
  it('only the students who are not Hadir, in lesson order', () => {
    const s = run(start(25), { type: 'allPresent' }, choose('s22', 'I'), choose('s5', 'T'), choose('s10', 'A'));
    expect(exceptions(s)).toEqual([
      { id: 's5', status: 'T' },
      { id: 's10', status: 'A' },
      { id: 's22', status: 'I' },
    ]);
  });
  it('the review lists the absent, fixed ones included', () => {
    const s = run(start(5, { 2: 'I' }, [2]), { type: 'allPresent' }, choose('s4', 'A'));
    expect(absentList(s)).toEqual([
      { id: 's2', status: 'I' },
      { id: 's4', status: 'A' },
    ]);
  });
  it('an all-present class sends no exceptions', () => {
    expect(exceptions(run(start(25), { type: 'allPresent' }))).toEqual([]);
  });
});

describe('the whole run of the contract: 25 students, 3 absent', () => {
  it('Semua hadir, 3 exceptions, review: 9 taps (1 + 3 x 2 + 2)', () => {
    let taps = 0;
    const tap = (...a: PresensiAction[]) => {
      taps += 1;
      return a;
    };
    let s = start(25);
    s = run(s, ...tap({ type: 'allPresent' }));
    for (const [id, status] of [['s4', 'T'], ['s9', 'S'], ['s21', 'A']] as const) {
      s = run(s, ...tap({ type: 'openSheet', id }));
      s = run(s, ...tap(choose(id, status)));
    }
    s = run(s, ...tap({ type: 'openReview' }));
    expect(s.review).toBe(true);
    taps += 1; // Kirim presensi
    expect(taps).toBe(9);
    expect(counts(s)).toMatchObject({ H: 22, T: 1, S: 1, A: 1, I: 0, unfilled: 0 });
  });
});

describe('load and help', () => {
  it('load replaces everything, so a fresh session never shows the last one', () => {
    const s = run(start(5), { type: 'allPresent' }, { type: 'load', roster: roster(2) });
    expect(s.order).toEqual(['s1', 's2']);
    expect(s.undo).toBeNull();
    expect(s.toast).toBeNull();
  });
  it('help opens and closes on its own', () => {
    const s = run(start(2), { type: 'openHelp' });
    expect(s.help).toBe(true);
    expect(run(s, { type: 'closeHelp' }).help).toBe(false);
  });
});
