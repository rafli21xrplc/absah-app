import type { Role } from '@absah/contracts';

/** Mirrors absah-api: GET /school/members (admin, operator, kepsek, wakasek); invitations and suspending are admin only. */
export const STAFF_READERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek'];
export const STAFF_MANAGERS: Role[] = ['admin'];
