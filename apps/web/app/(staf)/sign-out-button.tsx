'use client';

import { Button, Dialog, messages } from '@absah/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/auth';
import { offlineStore } from '@/lib/offline-queue';
import { useWorkspace } from '@/lib/workspace';

const t = messages.offline;

/**
 * "Keluar". Presensi that wait on the phone are not lost by signing out (the queue stays, keyed by user, and goes out when the
 * same user signs in again), but the teacher is told how many are still not at the school before the account closes.
 */
export function SignOutButton() {
  const router = useRouter();
  const { me, selectSchool } = useWorkspace();
  const [waiting, setWaiting] = useState<number | null>(null);

  async function leave() {
    await signOut();
    void offlineStore().clearCached(); // rosters kept for offline use do not stay on the phone
    selectSchool(null);
    router.replace('/masuk');
  }

  async function ask() {
    const n = (await offlineStore().queue(me.user.id)).length;
    if (n === 0) return leave();
    setWaiting(n);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => void ask()}>
        Keluar
      </Button>
      <Dialog
        open={waiting !== null}
        onOpenChange={(open) => !open && setWaiting(null)}
        alert
        title={t.signOutTitle}
        description={t.signOutBody.replace('{n}', String(waiting ?? 0))}
        cancelLabel={t.signOutStay}
        actions={
          <Button variant="primary" onClick={() => void leave()}>
            {t.signOutGo}
          </Button>
        }
      />
    </>
  );
}
