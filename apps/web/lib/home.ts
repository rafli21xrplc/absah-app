import { MeContextResponse } from '@absah/contracts';
import { api } from './api';
import { contextCacheKey, offlineStore } from './offline-queue';
import { storedSchool } from './workspace';

export type HomeStep = 'school' | 'today';

/**
 * What happens between "signed in" and the home page, as real steps the sign-in screen can show (StepList):
 * 1. who the person is and which school opens (GET /me/context) -> report('school', name)
 * 2. keep a copy of that answer on the device, so today's screens open without a signal (PRS-08) -> report('today')
 * Failing here never blocks the person: the home page loads the same data again, so the caller opens it either way.
 */
export async function prepareHome(report: (step: HomeStep, schoolName?: string) => void): Promise<void> {
  const base = await api('/me/context', MeContextResponse);
  const remembered = storedSchool();
  const school = base.schools.find((s) => s.id === remembered) ?? (base.schools.length === 1 ? base.schools[0] : undefined);
  report('school', school?.name);
  const me = school ? await api('/me/context', MeContextResponse, { schoolId: school.id }) : base;
  await offlineStore().keep(contextCacheKey, me);
  report('today');
}
