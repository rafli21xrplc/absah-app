import type { Role } from '@absah/contracts';

/** Mirrors absah-api canManageSchedule (the API enforces it). */
export const SCHEDULE_MANAGERS: Role[] = ['admin', 'operator', 'wakasek'];
/** The page lists rombel, so it needs canReadStudentData as well. */
export const SCHEDULE_PAGE_READERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek'];
