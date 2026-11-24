import type { Role } from '@absah/contracts';

/** Mirrors absah-api canReadStudentData / canManageStudentData (the API enforces them). */
export const STUDENT_READERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek'];
export const STUDENT_MANAGERS: Role[] = ['admin', 'operator'];
