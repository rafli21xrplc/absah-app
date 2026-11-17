import type { Role } from '@absah/contracts';

/** Mirror absah-api canSeeVisitors / canManageVisitors (the API enforces them). */
export const VISITOR_VIEWERS: Role[] = ['piket', 'admin', 'operator', 'wakasek', 'kepsek'];
export const VISITOR_MANAGERS: Role[] = ['piket', 'admin', 'operator', 'wakasek'];
