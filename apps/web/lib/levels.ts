import { LEVELS, type Level } from '@absah/capabilities';

/** UI labels per level; the level list itself comes from @absah/capabilities (absah-api). */
export const LEVEL_LABELS: Record<Level, string> = {
  sd: 'SD/MI',
  smp: 'SMP/MTs',
  sma: 'SMA/MA',
  smk: 'SMK/MAK',
};

export const LEVEL_OPTIONS = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
